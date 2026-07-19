import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dropdown,
  FileUploaderItem,
  FormLabel,
  InlineLoading,
  Modal,
  ProgressIndicator,
  ProgressStep,
  RadioButton,
  RadioButtonGroup,
  Tag,
} from '@carbon/react';
import {
  ArrowRight,
  CheckboxCheckedFilled,
  CheckmarkOutline,
  CloudUpload,
  Close,
  FingerprintRecognition,
  Information,
  PendingFilled,
  Renew,
  ScanDisabled,
  WarningAltFilled,
} from '@carbon/react/icons';
import { type Patient, showSnackbar } from '@openmrs/esm-framework';
import styles from './workflow-drawer.component.scss';
import { type HieClient, type RequestCustomOtpDto, type Scheme } from '../types';
import { getClientEligibityStatus } from '../../shared/services/eligibility.resource';
import { maskCrNumber, maskExceptFirstAndLast } from '../utils/mask-data';
import OtpVerificationStep from './otp-verification-step.component';
import EmrCompare from './emr-compare.component';
import EmrCreatePreview from './emr-create-preview.component';
import {
  getBiometricCaptureUrl,
  getOtpWhitelistStatus,
  isBiometricConfigured,
  requestOtpWhitelist,
} from './verification.resource';
import { fetchServiceQueuesByLocationUuid } from '../../resources/queue.resource';
import { fetchCashPoints, fetchPaymentModes } from '../../shared/services/billing.resource';
import { getReadableErrorMessage } from '../utils/error-handler';

type Phase =
  | 'biometric'
  | 'biometric-not-setup'
  | 'otp-gate'
  | 'whitelist-request'
  | 'whitelist-pending'
  | 'otp'
  | 'consent'
  | 'visit';

type Method = 'cash' | 'insurance';

const STEPS = ['Verify & consent', 'Start visit'];
const BIOMETRIC_MAX_ATTEMPTS = 3;

// Decode HTML entities in backend-provided names (e.g. "Accident &amp; Emergency").
function decodeHtmlEntities(value: string): string {
  if (!value || typeof document === 'undefined') {
    return value;
  }
  const el = document.createElement('textarea');
  el.innerHTML = value;
  return el.value;
}
const OTP_EXPIRY_SECONDS = 300; // 5 minutes

// Where the patient is sent first, and the rooms available for each category.
const PATIENT_CATEGORIES = ['Triage', 'Walk-in'];
const WALK_IN_ROOMS = [];

// Payment: exemption categories (when exempt) or insurance schemes (when insured).
// User-fee exemption categories recognised in the Kenyan public health system.
const EXEMPTION_CATEGORIES = [
  'Children under 5 years',
  'Maternity services',
  'Prisoners / persons in custody',
  'Elderly (65 years and above)',
  'Persons with disability',
  'Indigent / waiver (unable to pay)',
];

// Payment modes that are direct payment (not insurance schemes) — excluded from
// the insurance-scheme list.
const NON_INSURANCE_PAYMENT_MODES = /cash|mpesa|m-pesa|waiver/i;

// OpenMRS visit types (searchable).
const VISIT_TYPE_OPTIONS = ['Outpatient', 'Inpatient'];

// Reasons biometric identification could not be used (option set for the request).
const WHITELIST_REASONS = [
  'Biometric device not working',
  'Patient fingerprints not readable',
  'Patient has no usable fingerprints',
  'Fingerprint repeatedly not matching',
  'Other',
];

const phaseToIndex: Record<Phase, number> = {
  biometric: 0,
  'biometric-not-setup': 0,
  'otp-gate': 0,
  'whitelist-request': 0,
  'whitelist-pending': 0,
  otp: 0,
  consent: 0,
  visit: 1,
};

interface WorkflowDrawerProps {
  open: boolean;
  client?: HieClient;
  clientType?: string;
  locationUuid?: string;
  requestCustomOtpDto?: RequestCustomOtpDto;
  phoneNumber?: string;
  // EMR lookup result for the client, so the user can create or sync the record.
  amrsPatient?: Patient | null;
  amrsChecked?: boolean;
  syncingAmrs?: boolean;
  onCreatePatient?: () => void;
  onSyncPatient?: () => void;
  onClose: () => void;
  onStartVisit: (details: {
    patientCategory: string;
    room: string;
    roomUuid: string;
    visitType: string;
    exempted: boolean;
    method?: Method;
    exemptionCategory?: string;
    insurance?: string;
  }) => void;
}

const WorkflowDrawer: React.FC<WorkflowDrawerProps> = ({
  open,
  client,
  clientType,
  locationUuid,
  requestCustomOtpDto,
  phoneNumber,
  amrsPatient,
  amrsChecked,
  syncingAmrs,
  onCreatePatient,
  onSyncPatient,
  onClose,
  onStartVisit,
}) => {
  const [phase, setPhase] = useState<Phase>('biometric');
  const [pendingEmrAction, setPendingEmrAction] = useState<'create' | 'sync' | null>(null);
  const [isOtpWhitelisted, setIsOtpWhitelisted] = useState(false);
  const [consent, setConsent] = useState(false);
  const [launchingBiometric, setLaunchingBiometric] = useState(false);
  const [biometricUrl, setBiometricUrl] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [checkingWhitelist, setCheckingWhitelist] = useState(false);
  const [submittingWhitelist, setSubmittingWhitelist] = useState(false);
  const [showWhitelistForm, setShowWhitelistForm] = useState(false);
  const [reason, setReason] = useState('');
  const [failedImage, setFailedImage] = useState<File | null>(null);
  const [reasonError, setReasonError] = useState('');
  const [imageError, setImageError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [method, setMethod] = useState<Method>('cash');
  const [patientCategory, setPatientCategory] = useState<string>(PATIENT_CATEGORIES[0]);
  const [room, setRoom] = useState<string>('');
  const [exempted, setExempted] = useState<'yes' | 'no'>('no');
  const [exemptionCategory, setExemptionCategory] = useState<string>('');
  const [insurance, setInsurance] = useState<string>('');
  const [visitType, setVisitType] = useState<string>('');
  const [triageRooms, setTriageRooms] = useState<string[]>([]);
  // Maps each triage room label to its service-queue uuid, needed to enqueue the patient.
  const [triageQueueByRoom, setTriageQueueByRoom] = useState<Record<string, string>>({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [insuranceSchemes, setInsuranceSchemes] = useState<string[]>([]);
  const [loadingSchemes, setLoadingSchemes] = useState(false);
  const [hasCashPoint, setHasCashPoint] = useState<boolean | null>(null);
  const [hasCashMode, setHasCashMode] = useState<boolean | null>(null);
  const [shaScheme, setShaScheme] = useState<Scheme | null>(null);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [eligibilityChecked, setEligibilityChecked] = useState(false);
  const [roomError, setRoomError] = useState('');
  const [exemptionError, setExemptionError] = useState('');
  const [insuranceError, setInsuranceError] = useState('');
  const [visitTypeError, setVisitTypeError] = useState('');

  useEffect(() => {
    if (open) {
      setPhase(isBiometricConfigured() ? 'biometric' : 'biometric-not-setup');
      setPendingEmrAction(null);
      setIsOtpWhitelisted(false);
      setConsent(false);
      setLaunchingBiometric(false);
      setBiometricUrl(null);
      setFailCount(0);
      setReason('');
      setFailedImage(null);
      setReasonError('');
      setImageError('');
      setShowWhitelistForm(false);
      setMethod('cash');
      setPatientCategory(PATIENT_CATEGORIES[0]);
      setRoom('');
      setExempted('no');
      setExemptionCategory('');
      setInsurance('');
      setVisitType('');
      setRoomError('');
      setExemptionError('');
      setInsuranceError('');
      setVisitTypeError('');
      setTriageRooms([]);
      setTriageQueueByRoom({});
      setInsuranceSchemes([]);
      setHasCashPoint(null);
      setHasCashMode(null);
      setShaScheme(null);
      setEligibilityChecked(false);
    }
  }, [open]);

  // Check the patient's SHA (SHIF) eligibility up front so it can be shown on the
  // consent summary and appended to the SHA payment option.
  useEffect(() => {
    if (!open || !client?.id || !locationUuid) {
      return;
    }
    let active = true;
    setLoadingEligibility(true);
    setShaScheme(null);
    setSchemes([]);
    setEligibilityChecked(false);
    getClientEligibityStatus({ requestIdNumber: client.id, requestIdType: '3', locationUuid })
      .then((resp) => {
        if (!active) {
          return;
        }
        const allSchemes = resp?.schemes ?? [];
        const sha = allSchemes.find((s) => /sha|shif/i.test(s.schemeName) || s.coverageType === 'SHIF') ?? null;
        setShaScheme(sha);
        setSchemes(allSchemes);
        setEligibilityChecked(true);
      })
      .catch(() => {
        if (active) {
          setShaScheme(null);
          setSchemes([]);
          setEligibilityChecked(false);
        }
      })
      .finally(() => {
        if (active) {
          setLoadingEligibility(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, client?.id, locationUuid]);

  // Load triage service queues for the LOGGED-IN location only (queues whose
  // name contains "triage"), so rooms from other locations aren't shown.
  useEffect(() => {
    if (!open || !locationUuid) {
      return;
    }
    let active = true;
    setLoadingRooms(true);
    fetchServiceQueuesByLocationUuid(locationUuid)
      .then((resp) => {
        if (!active) {
          return;
        }
        const triageQueues = (resp?.results ?? [])
          // Strictly this location — never queues from sibling/child locations.
          .filter((q) => q.location?.uuid === locationUuid)
          .filter((q) => /triage/i.test(q.name ?? q.display ?? ''))
          .map((q) => ({ label: decodeHtmlEntities(q.display || q.name), uuid: q.uuid }))
          .filter((q) => q.label && q.uuid);
        const byRoom: Record<string, string> = {};
        for (const q of triageQueues) {
          // First queue wins for a given label (deduped below for the dropdown).
          if (!byRoom[q.label]) {
            byRoom[q.label] = q.uuid;
          }
        }
        setTriageQueueByRoom(byRoom);
        setTriageRooms(Array.from(new Set(triageQueues.map((q) => q.label))));
      })
      .catch((err) => {
        if (active) {
          showSnackbar({
            kind: 'error',
            title: 'Couldn’t load triage rooms',
            subtitle: getReadableErrorMessage(err, 'Please try again.'),
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoadingRooms(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, locationUuid]);

  // Payment modes are global; cash points are what's tied to a location. So we
  // (1) check the logged-in location has a cash point (can it collect payment),
  // and (2) load the global insurance schemes for the dropdown.
  useEffect(() => {
    if (!open || !locationUuid) {
      return;
    }
    let active = true;
    setLoadingSchemes(true);
    Promise.all([fetchCashPoints(), fetchPaymentModes()])
      .then(([cashPoints, modes]) => {
        if (!active) {
          return;
        }
        const facilityCashPoints = (cashPoints ?? []).filter(
          (cp) => !cp.retired && cp.location?.uuid === locationUuid,
        );
        setHasCashPoint(facilityCashPoints.length > 0);

        // Whether a "cash" payment mode is configured on the backend.
        setHasCashMode((modes ?? []).some((m) => !m.retired && /cash/i.test(m.name ?? '')));

        const schemes = (modes ?? [])
          .filter((m) => !m.retired && m.name && !NON_INSURANCE_PAYMENT_MODES.test(m.name))
          .map((m) => decodeHtmlEntities(m.name));
        setInsuranceSchemes(Array.from(new Set(schemes)));
      })
      .catch((err) => {
        if (active) {
          showSnackbar({
            kind: 'error',
            title: 'Couldn’t load payment options',
            subtitle: getReadableErrorMessage(err, 'Please try again.'),
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoadingSchemes(false);
        }
      });
    return () => {
      active = false;
    };
  }, [open, locationUuid]);

  // Check upfront whether OTP is already whitelisted for this client, so that
  // when biometrics fail we can go straight to sending the OTP.
  useEffect(() => {
    if (!open || !client) {
      return;
    }
    let active = true;
    getOtpWhitelistStatus(client.id).then((status) => {
      if (active) {
        setIsOtpWhitelisted(status === 'approved');
      }
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When we reach the OTP gate, resolve the whitelist status and route accordingly.
  useEffect(() => {
    if (phase !== 'otp-gate' || !client) {
      return;
    }
    let active = true;
    setCheckingWhitelist(true);
    getOtpWhitelistStatus(client.id)
      .then((status) => {
        if (!active) return;
        if (status === 'approved') {
          setPhase('otp');
        } else if (status === 'pending') {
          setPhase('whitelist-pending');
        } else {
          setPhase('whitelist-request');
        }
      })
      .finally(() => active && setCheckingWhitelist(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!open || !client) {
    return null;
  }

  const fullName = `${client.first_name} ${maskExceptFirstAndLast(client.middle_name)} ${maskExceptFirstAndLast(
    client.last_name,
  )}`;

  // Selected person shown as a patient header: initials avatar (colour-coded by
  // type) + name and type on one line, CR number on a subtle second line.
  const isPrincipal = clientType === 'Principal';
  const initials = `${client.first_name?.[0] ?? ''}${client.last_name?.[0] ?? ''}`.toUpperCase();
  const clientStrip = (
    <div className={styles.patientStrip}>
      <span className={`${styles.patientAvatar} ${isPrincipal ? styles.avatarPrincipal : styles.avatarDependant}`}>
        {initials}
      </span>
      <div className={styles.patientInfo}>
        <div className={styles.patientLine1}>
          <span className={styles.patientName}>{fullName}</span>
          {clientType ? (
            <Tag type={isPrincipal ? 'blue' : 'teal'} size="sm">
              {clientType}
            </Tag>
          ) : null}
        </div>
        <span className={styles.patientCr}>CR · {maskCrNumber(client.id)}</span>
      </div>
    </div>
  );

  // The single action button on the EMR status card. Clicking it opens a focused
  // confirmation dialog (emrConfirmModal) rather than expanding the card inline.
  const emrActionArea = (kind: 'create' | 'sync') => {
    const handler = kind === 'create' ? onCreatePatient : onSyncPatient;
    if (!handler) {
      return null;
    }
    return kind === 'create' ? (
      <Button kind="primary" size="sm" onClick={() => setPendingEmrAction('create')}>
        Create in EMR
      </Button>
    ) : (
      <Button kind="tertiary" size="sm" renderIcon={Renew} disabled={syncingAmrs} onClick={() => setPendingEmrAction('sync')}>
        {syncingAmrs ? 'Syncing…' : 'Sync'}
      </Button>
    );
  };

  // Focused confirmation dialog for the create / sync EMR actions.
  const emrConfirmModal = (
    <Modal
      open={pendingEmrAction !== null}
      size="sm"
      modalHeading={pendingEmrAction === 'create' ? 'Create patient in the EMR?' : 'Sync EMR record?'}
      primaryButtonText={pendingEmrAction === 'create' ? 'Yes, create' : 'Yes, sync'}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={syncingAmrs}
      onRequestClose={() => setPendingEmrAction(null)}
      onSecondarySubmit={() => setPendingEmrAction(null)}
      onRequestSubmit={() => {
        const action = pendingEmrAction;
        setPendingEmrAction(null);
        if (action === 'create') {
          onCreatePatient?.();
        } else if (action === 'sync') {
          onSyncPatient?.();
        }
      }}
    >
      <p className={styles.emrConfirmText}>
        {pendingEmrAction === 'create'
          ? `This patient does not yet exist in our records. A new EMR record will be created for CR ${maskCrNumber(
              client.id,
            )} so they can be registered and attended to.`
          : `This patient already exists in our records. Their EMR record for CR ${maskCrNumber(
              client.id,
            )} will be updated with the latest registry details so their information is current before they are attended to.`}
      </p>
    </Modal>
  );

  // Shows the EMR lookup result for the client and lets the user act on it:
  // create the patient in the EMR (not found) or sync an existing record (found).
  const emrStatusCard = !amrsChecked ? null : amrsPatient ? (
    <div className={`${styles.emrStatus} ${styles.emrStatusFound}`}>
      <span className={styles.emrStatusIcon}>
        <CheckmarkOutline size={20} />
      </span>
      <div className={styles.emrStatusBody}>
        <span className={styles.emrStatusTitle}>Patient found in the EMR</span>
        <span className={styles.emrStatusText}>
          CR {maskCrNumber(client.id)} already has a record. Review the differences below and update the EMR with the
          details you choose.
        </span>
        {amrsPatient.uuid ? (
          <EmrCompare client={client} patientUuid={amrsPatient.uuid} onUpdated={onSyncPatient} />
        ) : null}
      </div>
    </div>
  ) : (
    <div className={`${styles.emrStatus} ${styles.emrStatusMissing}`}>
      <span className={styles.emrStatusIcon}>
        <WarningAltFilled size={20} />
      </span>
      <div className={styles.emrStatusBody}>
        <span className={styles.emrStatusTitle}>Patient not found in the system</span>
        <span className={styles.emrStatusText}>
          No EMR record matches CR {maskCrNumber(client.id)}. Review the details below and create the record to
          continue.
        </span>
        <EmrCreatePreview client={client} onCreate={() => onCreatePatient?.()} />
      </div>
    </div>
  );

  const launchBiometric = async () => {
    setLaunchingBiometric(true);
    try {
      const url = await getBiometricCaptureUrl(client.id);
      if (url) {
        setBiometricUrl(url);
      } else {
        showSnackbar({ kind: 'error', title: 'Could not start biometric capture', subtitle: 'Please try again.' });
      }
    } finally {
      setLaunchingBiometric(false);
    }
  };

  const handleBiometricFailed = () => {
    const attempts = failCount + 1;
    setFailCount(attempts);
    setBiometricUrl(null);
    // Messaging is shown in-page (fail count on the scanner, fallback note on the
    // OTP screen) rather than as toasts.
    if (attempts >= BIOMETRIC_MAX_ATTEMPTS) {
      // If OTP is already whitelisted, go straight to sending it (with the
      // override option); otherwise route through the whitelist gate.
      setPhase(isOtpWhitelisted ? 'otp' : 'otp-gate');
    }
  };

  // `stay` keeps the current screen (both buttons) instead of moving to the
  // pending screen when the status is not yet approved.
  const checkWhitelistStatus = async (stay = false) => {
    setCheckingWhitelist(true);
    try {
      const status = await getOtpWhitelistStatus(client.id);
      if (status === 'approved') {
        setIsOtpWhitelisted(true);
        showSnackbar({ kind: 'success', title: 'Whitelisted', subtitle: 'You can now use OTP verification.' });
        setPhase('otp');
      } else {
        showSnackbar({ kind: 'info', title: 'Awaiting approval', subtitle: 'The SHA team has not approved this yet.' });
        if (!stay) {
          setPhase('whitelist-pending');
        }
      }
    } finally {
      setCheckingWhitelist(false);
    }
  };

  const submitWhitelistRequest = async () => {
    // Inline validation
    let valid = true;
    if (!reason.trim()) {
      setReasonError('Select a reason for OTP');
      valid = false;
    } else {
      setReasonError('');
    }
    if (!failedImage) {
      setImageError('Attach an image of the failed biometric');
      valid = false;
    } else {
      setImageError('');
    }
    if (!valid) {
      return;
    }
    setSubmittingWhitelist(true);
    try {
      await requestOtpWhitelist({ crId: client.id, reason, failureCount: failCount, failedBiometricImage: failedImage });
      showSnackbar({ kind: 'success', title: 'Request submitted', subtitle: 'Awaiting approval from the SHA team.' });
      setPhase('whitelist-pending');
    } finally {
      setSubmittingWhitelist(false);
    }
  };

  const handleStartVisit = () => {
    const isExempt = exempted === 'yes';
    const usingInsurance = !isExempt && method === 'insurance';

    // Inline validation for the required visit fields.
    let valid = true;
    if (!room) {
      setRoomError(`Select a ${patientCategory === 'Walk-in' ? 'walk-in' : 'triage'} room`);
      valid = false;
    }
    if (!visitType) {
      setVisitTypeError('Select a visit type');
      valid = false;
    }
    if (isExempt && !exemptionCategory) {
      setExemptionError('Select an exemption category');
      valid = false;
    }
    if (usingInsurance && !insurance) {
      setInsuranceError('Select an insurance scheme');
      valid = false;
    }
    if (!valid) {
      return;
    }

    onStartVisit({
      patientCategory,
      room,
      roomUuid: triageQueueByRoom[room] ?? '',
      visitType,
      exempted: isExempt,
      method: isExempt ? undefined : method,
      exemptionCategory: isExempt ? exemptionCategory : undefined,
      insurance: usingInsurance ? insurance : undefined,
    });
  };

  // SHA (SHIF) eligibility indicator, shown on the consent summary and beside the
  // SHA payment option.
  const shaActive = shaScheme?.coverage?.status === '1';

  // Insurance dropdown items. SHA carries its eligibility in the name and is not
  // selectable unless the patient is eligible (active).
  const insuranceItems = insuranceSchemes.map((name) => {
    const isSha = /sha|shif/i.test(name);
    if (!isSha) {
      return { id: name, label: name, isSha: false, eligible: true, disabled: false };
    }
    const suffix = loadingEligibility
      ? ' · checking eligibility…'
      : shaActive
        ? ' · eligible'
        : shaScheme
          ? ' · not active'
          : eligibilityChecked
            ? ' · not eligible'
            : ' · eligibility unknown';
    return { id: name, label: `${name}${suffix}`, isSha: true, eligible: shaActive, disabled: !shaActive };
  });

  const shaEligibilityTag = loadingEligibility ? (
    <InlineLoading className={styles.eligibilityLoading} description="Checking SHA eligibility…" />
  ) : (
    <Tag size="sm" type={shaActive ? 'green' : 'red'}>
      {shaActive ? 'SHA · Eligible' : shaScheme ? 'SHA · Not active' : eligibilityChecked ? 'SHA · Not eligible' : 'SHA · Unknown'}
    </Tag>
  );

  return (
    <>
      {/* Overlay does NOT close on click — the user must use Close or Cancel */}
      <div className={styles.overlay} />
      <aside className={styles.drawer} role="dialog" aria-label="Registration workflow">
        <header className={styles.header}>
          <h4 className={styles.title}>Patient registration</h4>
          <Button kind="ghost" size="sm" hasIconOnly iconDescription="Close" renderIcon={Close} onClick={onClose} />
        </header>

        <div className={styles.body}>
          {/* The stepper scrolls with the content */}
          <div className={styles.stepper}>
            <div className={styles.stepperCard}>
              <ProgressIndicator currentIndex={phaseToIndex[phase]} spaceEqually>
                {STEPS.map((label) => (
                  <ProgressStep key={label} label={label} />
                ))}
              </ProgressIndicator>
              <p className={styles.stepCaption}>
                Step {phaseToIndex[phase] + 1} of {STEPS.length}: <strong>{STEPS[phaseToIndex[phase]]}</strong>
              </p>
            </div>
          </div>

          <div className={styles.bodyInner}>
            {/* ---- Step 1: Verify — biometric ---- */}
          {phase === 'biometric' ? (
            <div className={styles.verifyContent}>
              {!biometricUrl && clientStrip}
              {!biometricUrl ? (
                <>
                  {/* The scanner card — the primary action */}
                  <div className={styles.biometricArea}>
                    <button
                      type="button"
                      className={styles.biometricLaunch}
                      onClick={launchBiometric}
                      disabled={launchingBiometric}
                    >
                      <span className={styles.biometricIcon}>
                        <FingerprintRecognition size={48} />
                      </span>
                      <span className={styles.biometricLaunchText}>
                        {launchingBiometric ? 'Starting scanner…' : 'Tap to scan fingerprint'}
                      </span>
                      <span className={styles.biometricLaunchHint}>Confirm the patient&apos;s identity</span>
                    </button>
                    {failCount > 0 ? (
                      <p className={styles.failNote}>
                        Attempt {failCount} of {BIOMETRIC_MAX_ATTEMPTS} failed. Please try again.
                      </p>
                    ) : (
                      <></>
                    )}
                  </div>
                  {/* The step-by-step guide, below the scanner */}
                  <div className={styles.guidePanel}>
                    <div className={styles.guideHead}>
                      <Information size={18} className={styles.guideHeadIcon} />
                      How verification works
                    </div>
                    <ol className={styles.guideSteps}>
                      <li>Scan the patient&apos;s fingerprint to confirm their identity.</li>
                      <li>If the fingerprint fails {BIOMETRIC_MAX_ATTEMPTS} times, switch to an OTP code.</li>
                      <li>If OTP isn&apos;t allowed for this patient yet, request OTP whitelisting.</li>
                      <li>Once approved (or if already allowed), verify with the OTP sent to their phone.</li>
                    </ol>
                  </div>
                </>
              ) : (
                <div className={styles.biometricFrameWrap}>
                  <iframe title="Fingerprint capture" src={biometricUrl} className={styles.biometricFrame} />
                  <div className={styles.capturePrompt}>
                    <span className={styles.capturePromptText}>Did the fingerprint match the patient?</span>
                    <span className={styles.capturePromptHint}>
                      {failCount > 0
                        ? `Attempt ${failCount + 1} of ${BIOMETRIC_MAX_ATTEMPTS}. After ${BIOMETRIC_MAX_ATTEMPTS} tries you'll switch to OTP.`
                        : `You have ${BIOMETRIC_MAX_ATTEMPTS} tries before switching to OTP.`}
                    </span>
                    <div className={styles.captureActions}>
                      <Button kind="secondary" size="sm" renderIcon={Renew} onClick={handleBiometricFailed}>
                        No, try again
                      </Button>
                      <Button
                        kind="primary"
                        size="sm"
                        renderIcon={CheckmarkOutline}
                        onClick={() => {
                          setConsent(true);
                          setPhase('consent');
                        }}
                      >
                        Yes, identified
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 1: Verify — biometric not configured ---- */}
          {phase === 'biometric-not-setup' ? (
            <div className={styles.verifyContent}>
              {clientStrip}
              <div className={`${styles.statusCard} ${styles.statusCardDanger}`}>
                <span className={`${styles.statusBadge} ${styles.statusBadgeDanger}`}>
                  <ScanDisabled size={20} />
                </span>
                <h5 className={styles.statusTitle}>Biometric not detected</h5>
                <p className={styles.statusText}>
                  We couldn&apos;t detect a fingerprint scanner on this workstation. You can proceed by verifying the
                  patient with a one-time PIN (OTP) sent to their phone.
                </p>
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={ArrowRight}
                  onClick={() => setPhase(isOtpWhitelisted ? 'otp' : 'otp-gate')}
                >
                  Use OTP instead
                </Button>
              </div>
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 1: Verify — checking whitelist ---- */}
          {phase === 'otp-gate' ? (
            <div className={styles.verifyContent}>
              <div className={styles.loadingCard}>
                <InlineLoading description="Checking OTP whitelist status…" />
              </div>
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 1: Verify — whitelist request ---- */}
          {phase === 'whitelist-request' ? (
            <div className={styles.verifyContent}>
              {!showWhitelistForm ? (
                <div className={styles.statusCard}>
                  <span className={styles.statusBadge}>
                    <WarningAltFilled size={24} />
                  </span>
                  <h5 className={styles.statusTitle}>Not whitelisted for OTP</h5>
                  <p className={styles.statusText}>
                    This patient isn&apos;t whitelisted to receive a One-Time Password. Request whitelisting from the SHA
                    team to continue verifying by OTP.
                  </p>
                  <div className={styles.statusActions}>
                    <Button kind="tertiary" size="sm" disabled={checkingWhitelist} onClick={() => checkWhitelistStatus(true)}>
                      {checkingWhitelist ? 'Checking…' : 'Check whitelist status'}
                    </Button>
                    <Button
                      kind="primary"
                      size="sm"
                      renderIcon={ArrowRight}
                      onClick={() => setShowWhitelistForm(true)}
                    >
                      Request whitelisting
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles.panel}>
                  <div className={styles.panelHead}>Request OTP whitelisting</div>
                <div className={styles.panelBody}>
                  <div className={styles.infoNote}>
                    <Information size={20} className={styles.infoNoteIcon} />
                    <p className={styles.infoNoteText}>
                      OTP is not yet approved for this patient. Submit the details below to request whitelisting from the
                      SHA team.
                    </p>
                  </div>
                  <div className={styles.readonlyField}>
                    <span className={styles.readonlyLabel}>Biometric attempts failed</span>
                    <span className={styles.readonlyValue}>
                      {failCount} of {BIOMETRIC_MAX_ATTEMPTS}
                    </span>
                  </div>
                  <Dropdown
                    id="whitelist-reason"
                    titleText={
                      <span>
                        Reason for OTP <span className={styles.required}>*</span>
                      </span>
                    }
                    label="Select a reason"
                    items={WHITELIST_REASONS}
                    selectedItem={reason || null}
                    invalid={!!reasonError}
                    invalidText={reasonError}
                    onChange={({ selectedItem }) => {
                      setReason((selectedItem as string) ?? '');
                      setReasonError('');
                    }}
                  />
                  <div className={styles.uploadField}>
                    <FormLabel>
                      Image of failed biometric <span className={styles.required}>*</span>
                    </FormLabel>
                    <p className={styles.uploadHint}>Screenshot or photo of the failed attempt · PNG or JPG · one file</p>
                    <div
                      className={`${styles.dropZone} ${dragOver ? styles.dropZoneActive : ''} ${
                        imageError ? styles.dropZoneInvalid : ''
                      }`}
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setFailedImage(file);
                          setImageError('');
                        }
                      }}
                    >
                      <span className={styles.dropIcon}>
                        <CloudUpload size={24} />
                      </span>
                      <span className={styles.dropTitle}>Drag and drop an image here</span>
                      <span className={styles.dropSubtitle}>or click to browse</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg"
                        className={styles.hiddenInput}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setFailedImage(file);
                          if (file) {
                            setImageError('');
                          }
                        }}
                      />
                    </div>
                    {failedImage ? (
                      <FileUploaderItem
                        name={failedImage.name}
                        status="edit"
                        iconDescription="Remove file"
                        onDelete={() => setFailedImage(null)}
                      />
                    ) : null}
                    {imageError ? <p className={styles.fieldError}>{imageError}</p> : null}
                  </div>
                  <Button
                    className={styles.submitBtn}
                    kind="primary"
                    size="sm"
                    disabled={submittingWhitelist || !reason.trim() || !failedImage}
                    onClick={submitWhitelistRequest}
                  >
                    {submittingWhitelist ? 'Submitting…' : 'Submit request'}
                  </Button>
                </div>
                </div>
              )}
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 1: Verify — whitelist pending ---- */}
          {phase === 'whitelist-pending' ? (
            <div className={styles.verifyContent}>
              <div className={styles.statusCard}>
                <span className={styles.statusBadge}>
                  <PendingFilled size={24} />
                </span>
                <h5 className={styles.statusTitle}>Awaiting approval</h5>
                <p className={styles.statusText}>
                  Your OTP whitelisting request is pending approval. Check back to see if it has been approved.
                </p>
                <Button kind="primary" size="sm" disabled={checkingWhitelist} onClick={() => checkWhitelistStatus()}>
                  {checkingWhitelist ? 'Checking…' : 'Check whitelist status'}
                </Button>
              </div>
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 1: Verify — OTP ---- */}
          {phase === 'otp' && requestCustomOtpDto ? (
            <div className={styles.verifyContent}>
              <OtpVerificationStep
                requestCustomOtpDto={requestCustomOtpDto}
                phoneNumber={phoneNumber ?? ''}
                timerSeconds={OTP_EXPIRY_SECONDS}
                biometricFailedCount={failCount}
                onVerified={() => {
                  setConsent(true);
                  setPhase('consent');
                }}
              />
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 2: Consent ---- */}
          {phase === 'consent' ? (
            <div className={styles.verifyContent}>
              <div className={styles.consentConfirmed}>
                <CheckboxCheckedFilled size={20} className={styles.consentConfirmedIcon} />
                <span className={styles.consentConfirmedText}>
                  The patient has consented to you accessing their details. You can now proceed.
                </span>
              </div>

              {consent ? (
                <>
                  <div className={styles.panel}>
                    <div className={styles.panelHead}>Patient details</div>
                    <div className={styles.panelBody}>
                      <dl className={styles.detailGrid}>
                        <div className={`${styles.detailRow} ${styles.detailFull}`}>
                          <dt>Full name</dt>
                          <dd>
                            {[client.first_name, client.middle_name, client.last_name].filter(Boolean).join(' ')}
                          </dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt>CR number</dt>
                          <dd>{client.id}</dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt>Phone number</dt>
                          <dd>{client.phone || '—'}</dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt>ID number</dt>
                          <dd>{client.identification_number || '—'}</dd>
                        </div>
                        <div className={styles.detailRow}>
                          <dt>SHA eligibility</dt>
                          <dd>{shaEligibilityTag}</dd>
                        </div>
                      </dl>

                      {shaActive && schemes.length > 0 ? (
                        <div className={styles.schemes}>
                          <div className={styles.schemesHead}>
                            Eligible scheme{schemes.length === 1 ? '' : 's'}
                          </div>
                          <ul className={styles.schemeList}>
                            {schemes.map((s, i) => {
                              const schemeActive = s.coverage?.status === '1';
                              return (
                                <li key={`${s.schemeName}-${i}`} className={styles.schemeItem}>
                                  <div className={styles.schemeTop}>
                                    <span className={styles.schemeName}>{s.schemeName}</span>
                                    <Tag size="sm" type={schemeActive ? 'green' : 'gray'}>
                                      {schemeActive ? 'Active' : 'Inactive'}
                                    </Tag>
                                  </div>
                                  <div className={styles.schemeMeta}>
                                    {s.memberType ? (
                                      <span>
                                        {s.memberType.charAt(0).toUpperCase() + s.memberType.slice(1).toLowerCase()}
                                      </span>
                                    ) : null}
                                    {s.coverage?.endDate ? <span>Valid to {String(s.coverage.endDate).slice(0, 10)}</span> : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {emrStatusCard}
                  {emrConfirmModal}
                </>
              ) : (
                <></>
              )}
            </div>
          ) : (
            <></>
          )}

          {/* ---- Step 3: Start visit ---- */}
          {phase === 'visit' ? (
            <div className={styles.verifyContent}>
              <div className={`${styles.panelBody} ${styles.scrollBody}`}>
                  <Dropdown
                    id="visit-type"
                    titleText={
                      <span>
                        Visit type<span className={styles.required}>*</span>
                      </span>
                    }
                    label="Select a visit type"
                    items={VISIT_TYPE_OPTIONS}
                    selectedItem={visitType || null}
                    invalid={!!visitTypeError}
                    invalidText={visitTypeError}
                    onChange={({ selectedItem }) => {
                      setVisitType((selectedItem as string) ?? '');
                      setVisitTypeError('');
                    }}
                  />
                  <div className={styles.formSection}>
                    <h6 className={styles.sectionLabel}>Patient category</h6>
                    <RadioButtonGroup
                      legendText="Where is the patient going first?"
                      name="patient-category-group"
                      orientation="horizontal"
                      valueSelected={patientCategory}
                      onChange={(v) => {
                        setPatientCategory(v as string);
                        setRoom('');
                        setRoomError('');
                      }}
                    >
                      {PATIENT_CATEGORIES.map((cat) => (
                        <RadioButton key={cat} id={`cat-${cat.toLowerCase()}`} labelText={cat} value={cat} />
                      ))}
                    </RadioButtonGroup>

                    <Dropdown
                      id="visit-room"
                      titleText={
                        <span>
                          {patientCategory === 'Walk-in' ? 'Walk-in room' : 'Triage room'}
                          <span className={styles.required}>*</span>
                        </span>
                      }
                      label={
                        patientCategory === 'Walk-in'
                          ? 'Select a walk-in room'
                          : loadingRooms
                            ? 'Loading triage rooms…'
                            : triageRooms.length === 0
                              ? 'No triage rooms for this location'
                              : 'Select a triage room'
                      }
                      items={patientCategory === 'Walk-in' ? WALK_IN_ROOMS : triageRooms}
                      disabled={patientCategory === 'Triage' && (loadingRooms || triageRooms.length === 0)}
                      selectedItem={room || null}
                      invalid={!!roomError}
                      invalidText={roomError}
                      onChange={({ selectedItem }) => {
                        setRoom((selectedItem as string) ?? '');
                        setRoomError('');
                      }}
                    />
                  </div>

                  <div className={styles.formSection}>
                    <h6 className={styles.sectionLabel}>Payment</h6>
                    <RadioButtonGroup
                      legendText="Is the patient exempted from payment?"
                      name="exempted-group"
                      orientation="horizontal"
                      valueSelected={exempted}
                      onChange={(v) => {
                        setExempted(v as 'yes' | 'no');
                        setExemptionError('');
                        setInsuranceError('');
                      }}
                    >
                      <RadioButton id="exempt-yes" labelText="Yes" value="yes" />
                      <RadioButton id="exempt-no" labelText="No" value="no" />
                    </RadioButtonGroup>

                    {exempted === 'no' && hasCashPoint === false ? (
                      <div className={styles.errorNote}>
                        <WarningAltFilled size={20} className={styles.errorNoteIcon} />
                        <p className={styles.errorNoteText}>
                          Payment modes have not been configured. Contact your system administrator.
                        </p>
                      </div>
                    ) : null}

                    {exempted === 'yes' ? (
                      <Dropdown
                        id="exemption-category"
                        titleText={
                          <span>
                            Exemption category<span className={styles.required}>*</span>
                          </span>
                        }
                        label="Select an exemption category"
                        items={EXEMPTION_CATEGORIES}
                        selectedItem={exemptionCategory || null}
                        invalid={!!exemptionError}
                        invalidText={exemptionError}
                        onChange={({ selectedItem }) => {
                          setExemptionCategory((selectedItem as string) ?? '');
                          setExemptionError('');
                        }}
                      />
                    ) : (
                      <>
                        <RadioButtonGroup
                          legendText="Payment method"
                          name="method-group"
                          orientation="horizontal"
                          valueSelected={method}
                          disabled={hasCashPoint === false}
                          onChange={(v) => {
                            setMethod(v as Method);
                            setInsuranceError('');
                          }}
                        >
                          <RadioButton id="method-cash" labelText="Cash" value="cash" />
                          <RadioButton id="method-insurance" labelText="Insurance" value="insurance" />
                        </RadioButtonGroup>

                        {method === 'cash' && hasCashMode === false ? (
                          <div className={styles.errorNote}>
                            <WarningAltFilled size={20} className={styles.errorNoteIcon} />
                            <p className={styles.errorNoteText}>
                              Cash payment mode is not set. Contact your system administrator.
                            </p>
                          </div>
                        ) : null}

                        {method === 'insurance' ? (
                          <Dropdown
                            id="insurance-scheme"
                            titleText={
                              <span>
                                Insurance scheme<span className={styles.required}>*</span>
                              </span>
                            }
                            label={
                              loadingSchemes
                                ? 'Loading insurance schemes…'
                                : insuranceSchemes.length === 0
                                  ? 'No insurance schemes available'
                                  : 'Select insurance scheme'
                            }
                            items={insuranceItems}
                            itemToString={(item) => (item ? item.label : '')}
                            itemToElement={(item) =>
                              item ? (
                                item.isSha ? (
                                  <span
                                    className={`${styles.schemePill} ${
                                      item.eligible ? styles.schemePillEligible : styles.schemePillIneligible
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                ) : (
                                  <span>{item.label}</span>
                                )
                              ) : null
                            }
                            disabled={loadingSchemes || insuranceSchemes.length === 0}
                            selectedItem={insuranceItems.find((i) => i.id === insurance) ?? null}
                            invalid={!!insuranceError}
                            invalidText={insuranceError}
                            onChange={({ selectedItem }) => {
                              if (!selectedItem) {
                                return;
                              }
                              if (selectedItem.disabled) {
                                // Patient isn't SHA-eligible — block the selection.
                                setInsurance('');
                                setInsuranceError('Patient is not eligible for SHA. Choose another scheme.');
                                return;
                              }
                              setInsurance(selectedItem.id);
                              setInsuranceError('');
                            }}
                          />
                        ) : (
                          <></>
                        )}

                        {method === 'insurance' && /sha|shif/i.test(insurance) ? (
                          <div className={styles.eligibilityRow}>
                            <span className={styles.eligibilityRowLabel}>Eligibility</span>
                            {shaEligibilityTag}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
              </div>
            </div>
          ) : (
            <></>
          )}
          </div>
        </div>

        <footer className={styles.footer}>
          {phase === 'consent' && amrsChecked && !amrsPatient ? (
            <span className={styles.footerHint}>
              <WarningAltFilled size={16} className={styles.footerHintIcon} />
              Create the patient in the EMR to continue.
            </span>
          ) : (
            <div />
          )}
          <div className={styles.footerRight}>
            <Button kind="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {phase === 'consent' ? (
              <Button
                kind="primary"
                size="sm"
                renderIcon={ArrowRight}
                // Block continuing until the patient exists in the EMR (found or created).
                disabled={!consent || !amrsPatient}
                onClick={() => setPhase('visit')}
              >
                Continue
              </Button>
            ) : (
              <></>
            )}
            {phase === 'visit' ? (
              <Button
                kind="primary"
                size="sm"
                renderIcon={ArrowRight}
                disabled={
                  !room ||
                  !visitType ||
                  (exempted === 'yes' && !exemptionCategory) ||
                  (exempted === 'no' && hasCashPoint === false) ||
                  (exempted === 'no' && method === 'cash' && hasCashMode === false) ||
                  (exempted === 'no' && method === 'insurance' && !insurance)
                }
                onClick={handleStartVisit}
              >
                Start visit &amp; send to {patientCategory === 'Walk-in' ? 'walk-in' : 'triage'}
              </Button>
            ) : (
              <></>
            )}
          </div>
        </footer>
      </aside>
    </>
  );
};

export default WorkflowDrawer;
