import React from 'react';

import styles from './dialysis-chart.scss';

const DialysisChart: React.FC = () => {
  return (
    <>
      <div className={styles.headerContainer}>
        <div className={styles.county}>County Government of Uasin Gishu</div>

        <div className={styles.department}>Department of Health Services</div>

        <div className={styles.hospitalName}>Kesses Sub-County Hospital</div>

        <div className={styles.encounterType}>DIALYSIS CHART</div>
      </div>
    </>
  );
};

export default DialysisChart;
