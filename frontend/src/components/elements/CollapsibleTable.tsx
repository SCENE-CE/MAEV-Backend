import {
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel, TextField
} from "@mui/material";
import { Row } from "./Row.tsx";
import { ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
interface RowData {
  value: ReactNode;
  align?: 'right' | 'left' | 'center';
}

interface RowProps {
  id: number;
  data: RowData[];
}

interface Column {
  label: string;
  align?: 'right' | 'left' | 'center';
  sortKey?: string;
}

interface CollapsibleTableProps {
  columns: Column[];
  rows: RowProps[];
  renderExpandableContent?: (row: RowProps) => ReactNode;
  onActionClick?: (row: RowProps) => void;
}

export default function CollapsibleTable(
  {
    columns,
    rows,
    renderExpandableContent,
    onActionClick,
  }: CollapsibleTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filter, setFilter] = useState('');
  const { t } = useTranslation();

  const handleSort = (key: string | undefined) => {
    if (!key) return;

    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const filteredRows = useMemo(() => {
    if (!filter) return rows;

    return rows.filter((row) =>
      row.data.some((cell) =>
        String(cell.value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [rows, filter]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aValue = a.data.find((_cell, index) => columns[index]?.sortKey === sortKey)?.value;
      const bValue = b.data.find((_cell, index) => columns[index]?.sortKey === sortKey)?.value;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      return 0;
    });
  }, [filteredRows, sortKey, sortDirection, columns]);

  return (
    <>
      <Grid container spacing={2} alignItems="center" sx={{ marginBottom: 2 }}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label={t('filter')}
            variant="outlined"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </Grid>
      </Grid>
      <TableContainer component={Paper}>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell />
              {columns.map((column) => (
                <TableCell key={column.label} align={column.align || 'left'}>
                  {column.sortKey ? (
                    <TableSortLabel
                      active={sortKey === column.sortKey}
                      direction={sortKey === column.sortKey ? sortDirection : 'asc'}
                      onClick={() => handleSort(column.sortKey)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              <TableCell align="center">{t('actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.map((row) => (
              <Row
                key={row.id}
                row={row}
                renderExpandableContent={renderExpandableContent}
                onActionClick={onActionClick}
              />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}