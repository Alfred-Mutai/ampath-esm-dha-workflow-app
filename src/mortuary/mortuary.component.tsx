import React from 'react';
import { ExtensionSlot } from '@openmrs/esm-framework';

const Mortuary: React.FC = () => {
  
  return (
    <div>
      <ExtensionSlot name="mortuary-dashboard-slot" />
    </div>
  );
};

export default Mortuary;
