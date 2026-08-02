import React from 'react';
import { ConfigurableLink } from '@openmrs/esm-framework';
import classNames from 'classnames';
import { SideNavMenu } from '@carbon/react';
import { specializedClinicsNavLinksConfig } from './specialized-clinics-nav-link-config';

interface NavLinksProps {}
const SpecializedClinicsNavLinks: React.FC<NavLinksProps> = () => {
  return (
    <>
      {specializedClinicsNavLinksConfig.map((n) => {
        if (n.children && n.children.length > 0) {
          return (
            <SideNavMenu title={n.title}>
              {n.children.map((c) => {
                return (
                  <ConfigurableLink
                    to={`${window.getOpenmrsSpaBase()}home/${n.to}/${c.to}`}
                    className={classNames('cds--side-nav__link', '')}
                  >
                    {c.title}
                  </ConfigurableLink>
                );
              })}
            </SideNavMenu>
          );
        } else {
          return (
            <ConfigurableLink
              to={`${window.getOpenmrsSpaBase()}home/${n.to}`}
              className={classNames('cds--side-nav__link', '')}
            >
              {n.title}
            </ConfigurableLink>
          );
        }
      })}
    </>
  );
};

export default SpecializedClinicsNavLinks;
