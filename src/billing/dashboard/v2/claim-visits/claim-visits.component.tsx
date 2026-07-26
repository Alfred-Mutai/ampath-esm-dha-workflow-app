import React, { useEffect, useState } from 'react';
import styles from './claim-visits.component.scss';
import { fetchFacilityClaimVisits } from '../../../billing-claims.resource';
import { type ClaimVisitReponse, type ClaimVisitsDto } from '../types';
import { formatDate, parseDate, showSnackbar } from '@openmrs/esm-framework';
import {
  Button,
  InlineLoading,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import ClaimVisitDetailsModal from './modal/claim-visit-details/claim-visit-details.modal';
import TableToolbar from '../shared/table-toolbar.component';
interface claimVisitsProps {
  locationUuid: string;
  billingDate: string;
  onDateChange?: (value: string) => void;
}
const ClaimVisits: React.FC<claimVisitsProps> = ({ locationUuid, billingDate, onDateChange }) => {
  const [claimVisits, setClaimVisits] = useState<ClaimVisitReponse[]>();
  const [showClaimsVisitModal, setShowClaimsVisitModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [consentToken, setConsentToken] = useState<string>();
  const [search, setSearch] = useState<string>('');
  // The modal loads the claim from the token itself — including the wait, and the guard
  // against SWR serving the claim opened before this one.
  useEffect(() => {
    if (locationUuid && billingDate) {
      getFacilityClaimVisits();
    }
  }, [locationUuid, billingDate]);
  if (!locationUuid || !billingDate) {
    return <></>;
  }
  function generateClaimsVisitPayload(): ClaimVisitsDto {
    return {
      locationUuid: locationUuid ?? '',
      visitDate: billingDate,
    };
  }
  async function getFacilityClaimVisits() {
    setLoading(true);
    const facilityClaimsVisitsPayload = generateClaimsVisitPayload();
    try {
      const data = await fetchFacilityClaimVisits(facilityClaimsVisitsPayload);
      if (data) {
        setClaimVisits(data);
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching facility bills',
        subtitle: 'An error occurred while fetehcing facility bills, please reload or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  async function handleSelectedClaimsVisit(selectedVisit: ClaimVisitReponse) {
    setConsentToken(selectedVisit.authorizationCode);
    setShowClaimsVisitModal(true);
  }
  function handleCloseClaimsModal() {
    setShowClaimsVisitModal(false);
  }
  return (
    <>
      <div className={styles.claimVisitsLayout}>
        <TableToolbar
          id="claim-visits"
          search={search}
          onSearch={setSearch}
          date={billingDate}
          onDate={onDateChange}
          searchPlaceholder="Search patient or service type…"
        />
        <Table aria-label="claim visits" size="sm">
          <TableHead>
            <TableRow>
              <TableHeader>No</TableHeader>
              <TableHeader>Date</TableHeader>
              <TableHeader>Patient</TableHeader>
              <TableHeader>Service Type</TableHeader>
              <TableHeader>Action</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {(claimVisits ?? [])
              .filter((cv) => {
                const term = search.trim().toLowerCase();
                return !term || `${cv.patientId} ${cv.serviceType}`.toLowerCase().includes(term);
              })
              .map((cv, index) => {
                return (
                  <>
                    <TableRow key={cv.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatDate(parseDate(cv.visitStart))}</TableCell>
                      <TableCell>
                        <div>{cv.patientId}</div>
                      </TableCell>
                      <TableCell>{cv.serviceType}</TableCell>
                      <TableCell>
                        <Button kind="ghost" onClick={() => handleSelectedClaimsVisit(cv)} size="sm">
                          {loading ? <InlineLoading description="Fetching data...." /> : 'View Claim'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
        {showClaimsVisitModal && consentToken ? (
          <ClaimVisitDetailsModal
            open={showClaimsVisitModal}
            consentToken={consentToken}
            handleClose={handleCloseClaimsModal}
            locationUuid={locationUuid}
          />
        ) : (
          <></>
        )}
      </div>
    </>
  );
};

export default ClaimVisits;
