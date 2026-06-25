import React, { useEffect, useState } from 'react';
import { type EligibilityFilterDto, type HieClientEligibility } from '../../types';
import { getTagType } from '../../../shared/utils/get-tag-type';
import { Button, InlineLoading, Tag } from '@carbon/react';
import { getClientEligibityStatus } from '../../../shared/services/eligibility.resource';
import styles from './eligibility-tags.scss';
import ClientEligibilityDetailsModal from '../modal/eligibility-details.modal';
import { showSnackbar } from '@openmrs/esm-framework';
interface EligibilityTags {
  crId: string;
  locationUuid: string;
}
const EligibilityTags: React.FC<EligibilityTags> = ({ crId, locationUuid }) => {
  const [clientEligibility, setClientEligibility] = useState<HieClientEligibility>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayEligibilityDetailsModal, setDisplayEligibilityDetailsModal] = useState<boolean>(false);
  useEffect(() => {
    getPatientEligibilityStatus();
  }, [crId]);

  if (!crId) {
    return <></>;
  }

  function generatePatientEligibilityPayload(): EligibilityFilterDto {
    const payload: EligibilityFilterDto = {
      requestIdNumber: '',
      requestIdType: '',
      locationUuid: locationUuid,
    };

    if (crId) {
      payload.requestIdNumber = crId;
      payload.requestIdType = '3';
    }

    return payload;
  }

  async function getPatientEligibilityStatus() {
    setIsLoading(true);
    const payload = generatePatientEligibilityPayload();
    if (!isValidEligibilityPayload(payload)) {
      setIsLoading(false);
      return;
    }
    try {
      const resp = await getClientEligibityStatus(payload);
      setClientEligibility(resp);
    } catch (error) {
      showSnackbar({
        kind: 'error',
        title: 'Failed getting eligibility status',
        subtitle: 'An error occurred while fetching eligibility status. Please try again or contact support',
      });
    } finally {
      setIsLoading(false);
    }
  }

  function isValidEligibilityPayload(eligibilityFilterDto: EligibilityFilterDto): boolean {
    if (!eligibilityFilterDto.locationUuid) {
      return false;
    }
    if (!eligibilityFilterDto.requestIdNumber) {
      return false;
    }
    if (!eligibilityFilterDto.requestIdType) {
      return false;
    }

    return true;
  }
  function handleModalClose() {
    setDisplayEligibilityDetailsModal(false);
  }
  function showEligibilityDetailsModal() {
    setDisplayEligibilityDetailsModal(true);
  }
  return (
    <>
      <div className={styles.eligibilityTagsLayout}>
        {isLoading ? (
          <>
            <InlineLoading description="Fetching Eligibility data..." />
          </>
        ) : (
          <>
            {clientEligibility ? (
              <>
                {clientEligibility.schemes && clientEligibility.schemes.length > 0 ? (
                  <>
                    {clientEligibility.schemes.map((s) => {
                      return (
                        <div>
                          <Tag className="some-class" size="md" title="Status" type={getTagType(s.coverage.status)}>
                            {s.schemeName} : {s.coverage.status === '1' ? 'Active' : 'Not Active'}
                          </Tag>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div>
                    <Tag className="some-class" size="md" title="Status" type="gray">
                      No Insurance schemes found
                    </Tag>
                  </div>
                )}
              </>
            ) : (
              <></>
            )}
          </>
        )}
      </div>
    </>
  );
};
export default EligibilityTags;
