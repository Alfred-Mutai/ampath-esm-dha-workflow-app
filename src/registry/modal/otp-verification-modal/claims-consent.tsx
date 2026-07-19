import React, { useState } from 'react';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import BiometricsVerificationModal from '../biometrics-verification-modal/biometrics-verification-modal';
import OTPWhitlistingModal from '../otp-modal/otp-whitlisting-modal.component';
import { type OtpFormData, type OTPWhitelistRequest } from '../../hie.types';

interface ClaimsConsentModalProps {
  submitting: boolean;
  otpSent: boolean;
  whitelistRequest: any;
  onWhitelistSubmit: (payload: OTPWhitelistRequest) => Promise<any>;
  onSendClaimsOtp: () => Promise<any>;
  onOtpVerified: (otp: string) => Promise<any>;
  onOtpVerificationStatusChange: (verified: boolean) => void;
  serviceType: string;
  interventionCode: string;
  crId: string;
  onScanStatusChange: (status: string) => void;
}
const ClaimsConsentModal: React.FC<ClaimsConsentModalProps> = ({
  onSendClaimsOtp,
  onWhitelistSubmit,
  onOtpVerified,
  submitting,
  otpSent,
  whitelistRequest,
  serviceType,
  interventionCode,
  crId,
  onScanStatusChange,
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [whiteListed, setIsWhitelisted] = useState<boolean>();
  const [otpVerified, setOtpVerified] = useState(false);

  return (
    <>
      <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
        <TabList>
          <Tab>Biometrics Verification</Tab>
          <Tab>OTP Verification</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <BiometricsVerificationModal
              open={false}
              onClose={() => {}}
              serviceType={serviceType}
              interventionCode={interventionCode}
              onScanStatusChange={onScanStatusChange}
            />
          </TabPanel>
          <TabPanel>
            <OTPWhitlistingModal
              submitting={submitting}
              otpSent={otpSent}
              whitelistRequest={whitelistRequest}
              onWhitelistStatusChange={setIsWhitelisted}
              onWhitelistSubmit={onWhitelistSubmit}
              onSendClaimsOtp={onSendClaimsOtp}
              onOtpVerified={onOtpVerified}
              onOtpVerificationStatusChange={setOtpVerified}
              crId={crId}
            />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </>
  );
};

export default ClaimsConsentModal;
