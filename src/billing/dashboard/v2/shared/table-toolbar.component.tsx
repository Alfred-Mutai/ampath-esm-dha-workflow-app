import React from 'react';
import { DatePicker, DatePickerInput, Search } from '@carbon/react';
import styles from './table-toolbar.component.scss';

interface TableToolbarProps {
  id: string;
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  date?: string;
  onDate?: (value: string) => void;
}

/** Search (2/3 width) + a date filter (1/3 width) on the same row above a table. */
const TableToolbar: React.FC<TableToolbarProps> = ({
  id,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  date,
  onDate,
}) => (
  <div className={styles.toolbar}>
    <Search
      id={`${id}-search`}
      className={styles.search}
      size="md"
      labelText="Search"
      placeholder={searchPlaceholder}
      value={search}
      onChange={(e) => onSearch(e.target.value)}
      onClear={() => onSearch('')}
    />
    {onDate ? (
      <DatePicker
        className={styles.date}
        datePickerType="single"
        dateFormat="Y-m-d"
        value={date || undefined}
        onChange={(d) => onDate(d?.[0] ? new Date(d[0]).toLocaleDateString('en-CA') : '')}
      >
        <DatePickerInput id={`${id}-date`} size="md" labelText="" placeholder="yyyy-mm-dd" />
      </DatePicker>
    ) : null}
  </div>
);

export default TableToolbar;
