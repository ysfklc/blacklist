import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

export interface SortableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (value: any, item: any) => React.ReactNode;
  headerRender?: () => React.ReactNode;
}

export interface SortableTableProps {
  data: any[];
  columns: SortableColumn[];
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (item: any) => void;
  renderRowActions?: (item: any) => React.ReactNode;
  sortConfig?: SortConfig | null;
  onSort?: (key: string, direction: 'asc' | 'desc' | null) => void;
  serverSide?: boolean;
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export function SortableTable({
  data,
  columns,
  isLoading,
  emptyMessage = "No data available",
  className,
  onRowClick,
  renderRowActions,
  sortConfig: externalSortConfig,
  onSort,
  serverSide = false,
}: SortableTableProps) {
  const [internalSortConfig, setInternalSortConfig] = useState<SortConfig | null>(null);
  const sortConfig = serverSide ? externalSortConfig : internalSortConfig;

  const sortedData = useMemo(() => {
    if (serverSide || !sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.key);
      const bValue = getNestedValue(b, sortConfig.key);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const result = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
        return sortConfig.direction === 'asc' ? result : -result;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        const result = aValue - bValue;
        return sortConfig.direction === 'asc' ? result : -result;
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        const result = aValue.getTime() - bValue.getTime();
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Handle date strings
      if (typeof aValue === 'string' && typeof bValue === 'string' && 
          isValidDate(aValue) && isValidDate(bValue)) {
        const dateA = new Date(aValue);
        const dateB = new Date(bValue);
        const result = dateA.getTime() - dateB.getTime();
        return sortConfig.direction === 'asc' ? result : -result;
      }

      // Default string comparison
      const result = String(aValue).toLowerCase().localeCompare(String(bValue).toLowerCase());
      return sortConfig.direction === 'asc' ? result : -result;
    });
  }, [data, sortConfig, serverSide]);

  const handleSort = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return;

     if (serverSide && onSort) {
      const current = sortConfig;
      if (current?.key === key) {
        if (current.direction === 'asc') {
          onSort(key, 'desc');
        } else {
          onSort(key, null);
        }
      } else {
        onSort(key, 'asc');
      }
    } else {
      setInternalSortConfig(current => {
        if (current?.key === key) {
          if (current.direction === 'asc') {
            return { key, direction: 'desc' };
          } else {
            return null; // Remove sorting
          }
        } else {
          return { key, direction: 'asc' };
        }
      });
    }
  };

  const getSortIcon = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return null;

    if (sortConfig?.key === key) {
      return sortConfig.direction === 'asc' ? 
        <ChevronUp className="h-4 w-4" /> : 
        <ChevronDown className="h-4 w-4" />;
    }
    return <ChevronsUpDown className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className={className}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
              {renderRowActions && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </TableCell>
                ))}
                {renderRowActions && (
                  <TableCell className="text-right">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.headerRender ? (
                  column.headerRender()
                ) : column.sortable ? (
                  <Button
                    variant="ghost"
                    onClick={() => handleSort(column.key)}
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                  >
                    <span className="flex items-center gap-1">
                      {column.label}
                      {getSortIcon(column.key)}
                    </span>
                  </Button>
                ) : (
                  column.label
                )}
              </TableHead>
            ))}
            {renderRowActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell 
                colSpan={columns.length + (renderRowActions ? 1 : 0)} 
                className="text-center py-8 text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((item, index) => (
              <TableRow 
                key={item.id || index}
                onClick={() => onRowClick?.(item)}
                className={onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}
              >
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render ? 
                      column.render(getNestedValue(item, column.key), item) : 
                      getNestedValue(item, column.key)
                    }
                  </TableCell>
                ))}
                {renderRowActions && (
                  <TableCell className="text-right">
                    {renderRowActions(item)}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// Helper function to get nested object values
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
}

// Helper function to check if a string is a valid date
function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.includes('-');
}