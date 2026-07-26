import React from 'react';
import styles from './claim-visit-details.modal.scss';
import { Modal, ModalBody } from '@carbon/react';
import ClaimVisitDetails from '../../claim-visit-details/claim-visit-details.component';
import ClaimDetailsByToken from '../../claim-visit-details/claim-details-by-token.component';
import { type ClaimsVisit } from '../../../types';
interface claimVisitDetailsModalProps {
  open: boolean;
  locationUuid: string;
  handleClose: () => void;
  /** An already-loaded claim. Give this or `consentToken`. */
  claimsVisit?: ClaimsVisit;
  /** Load the claim live from its consent token — for callers holding a claim listing
      rather than the claim itself. */
  consentToken?: string;
  /** Only meaningful alongside `claimsVisit`: whether that claim's state has been
      confirmed live. A claim loaded from a token is live by definition. */
  claimStateUnconfirmed?: boolean;
}
const ClaimVisitDetailsModal: React.FC<claimVisitDetailsModalProps> = ({
  open,
  claimsVisit,
  consentToken,
  handleClose,
  locationUuid,
  claimStateUnconfirmed,
}) => {
  return (
    <>
      <Modal
        open={open}
        size="lg"
        onSecondarySubmit={() => {}}
        onRequestClose={handleClose}
        onRequestSubmit={() => {}}
        primaryButtonText=""
        secondaryButtonText="Close"
      >
        <ModalBody>
          <div className={styles.cvModalLayout}>
            {claimsVisit ? (
              <ClaimVisitDetails
                claimsVisit={claimsVisit}
                locationUuid={locationUuid}
                claimStateUnconfirmed={claimStateUnconfirmed}
              />
            ) : (
              <ClaimDetailsByToken consentToken={consentToken ?? ''} locationUuid={locationUuid} />
            )}
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};
export default ClaimVisitDetailsModal;
