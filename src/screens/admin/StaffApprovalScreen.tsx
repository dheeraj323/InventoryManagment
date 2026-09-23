import React from 'react';
import { StaffManagementScreen } from './StaffManagementScreen';

/**
 * Backward compatibility wrapper.
 * Replaced the limited verification-only screen with the complete Staff Management system.
 */
export const StaffApprovalScreen: React.FC<{ navigation: any; route?: any }> = (props) => {
  return <StaffManagementScreen {...props} />;
};

export default StaffApprovalScreen;
