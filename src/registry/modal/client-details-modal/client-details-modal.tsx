import { Modal, ModalBody, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { type HieClientEligibility, type EligibilityFilterDto, type HieClient } from '../../types';
import React, { useEffect, useState } from 'react';
import styles from './client-details-modal.scss';
import ClientDetails from '../../client-details/client-details';
import { showSnackbar, useSession } from '@openmrs/esm-framework';
import { getClientEligibityStatus } from '../../../shared/services/eligibility.resource';
import EligibilityDetails from '../../eligibility/eligibility-details/eligibility-details';

interface ClientDetailsModalProps {
  client: HieClient;
  open: boolean;
  onModalClose: () => void;
  onSubmit: (crId: string) => void;
}

const ClientDetailsModal: React.FC<ClientDetailsModalProps> = ({
  client,
  open,
  onModalClose,
  onSubmit,
}) => {
  const session = useSession();
  const locationUuid = session.sessionLocation?.uuid;
  const [clientEligibility, setClientEligibility] = useState<HieClientEligibility>();
  useEffect(() => {
    if (client && client.id) {
      getPatientEligibilityStatus();
    }
  }, [client]);
  if (!client) {
    return <>No Client data</>;
  }
  function generatePatientEligibilityPayload(): EligibilityFilterDto {
    const payload: EligibilityFilterDto = {
      requestIdNumber: '',
      requestIdType: '',
      locationUuid: locationUuid ?? '',
    };

    if (client && client.id) {
      payload.requestIdNumber = client.id;
      payload.requestIdType = '3';
    }

    return payload;
  }

  async function getPatientEligibilityStatus() {
    const payload = generatePatientEligibilityPayload();
    if (!isValidEligibilityPayload(payload)) {
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
  return (
    <>
      <Modal
        open={open}
        size="lg"
        onSecondarySubmit={onModalClose}
        onRequestClose={onModalClose}
        onRequestSubmit={() => onSubmit(client.id)}
        primaryButtonText="Next"
        secondaryButtonText="Cancel"
      >
        <ModalBody>
          <div className={styles.clientDetailsLayout}>
            <div className={styles.sectionHeader}>
              <h4 className={styles.sectionTitle}>Patient Details</h4>
            </div>
            <div className={styles.sectionContent}>
              <Tabs>
                <TabList contained>
                  <Tab>Patient Details</Tab>
                  <Tab>Eligibility Details</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <ClientDetails client={client} />
                  </TabPanel>
                  <TabPanel>
                    {clientEligibility && <EligibilityDetails hieClientEligibility={clientEligibility} />}
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ClientDetailsModal;
