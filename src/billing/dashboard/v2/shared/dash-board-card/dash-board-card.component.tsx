import React from 'react';
import styles from './dash-board-card.component.scss';
interface DashboardCardProps {
  title: string;
  value: number;
}
const DashboardCard: React.FC<DashboardCardProps> = ({ title, value }) => {
  return (
    <div className={styles.statCard}>
      <div className={styles.statTitle}>{title}</div>
      <div className={styles.startVal}>{value}</div>
    </div>
  );
};
export default DashboardCard;
