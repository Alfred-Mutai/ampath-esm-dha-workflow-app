import React, { useEffect, useState } from 'react';
import styles from './claim-visits.component.scss';
import { fetchFacilityClaimVisits, fetchProviderClaimPreview } from '../../../billing-claims.resource';
import { type ProviderClaimPreviewDto, type ClaimsVisit, type ClaimVisitReponse, type ClaimVisitsDto } from '../types';
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
import ClaimVisitDetailsModal from './modal/claim-visit-details.modal';
interface claimVisitsProps {
  locationUuid: string;
  billingDate: string;
}
const ClaimVisits: React.FC<claimVisitsProps> = ({ locationUuid, billingDate }) => {
  const [claimVisits, setClaimVisits] = useState<ClaimVisitReponse[]>();
  const [selectedClaimVisit, setSelectedClaimVisit] = useState<ClaimsVisit | null>(null);
  const [showClaimsVisitModal, setShowClaimsVisitModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
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
    setLoading(true);
    const previewPayload = getProviderPreviewPayload(selectedVisit.authorizationCode);
    try {
      const resp = await fetchProviderClaimPreview(previewPayload);
      if (resp) {
        setSelectedClaimVisit(resp);
        setShowClaimsVisitModal(true);
      } else {
        setSelectedClaimVisit(null);
        setShowClaimsVisitModal(false);
      }
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Error fetching provider preview',
        subtitle: 'An error was encountered while fetching the claim preview, retry or contact support',
      });
    } finally {
      setLoading(false);
    }
  }
  function getProviderPreviewPayload(consentToken: string): ProviderClaimPreviewDto {
    return {
      locationUuid: locationUuid,
      consentToken: consentToken,
    };
  }
  function handleCloseClaimsModal() {
    setShowClaimsVisitModal(false);
    setSelectedClaimVisit(null);
  }
  return (
    <>
      <div className={styles.claimVisitsLayout}>
        <Table aria-label="sample table" size="lg">
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
            {claimVisits &&
              claimVisits.map((cv, index) => {
                return (
                  <>
                    <TableRow key={cv.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{formatDate(parseDate(cv.visitStart))}</TableCell>
                      <TableCell>
                        <div>{cv.patientId}</div>
                      </TableCell>
                      <TableCell>{cv.serviceType}</TableCell>
                      <Button kind="ghost" onClick={() => handleSelectedClaimsVisit(cv)} size="sm">
                        {loading ? <InlineLoading description="Fetching data...." /> : 'View Claim'}
                      </Button>
                    </TableRow>
                  </>
                );
              })}
          </TableBody>
        </Table>
        {showClaimsVisitModal && selectedClaimVisit ? (
          <>
            <ClaimVisitDetailsModal
              open={showClaimsVisitModal}
              claimsVisit={selectedClaimVisit}
              handleClose={handleCloseClaimsModal}
            />
          </>
        ) : (
          <></>
        )}
      </div>
    </>
  );
};

export default ClaimVisits;
