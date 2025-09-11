import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Search, Filter, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => React.ReactNode
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  className?: string
  onRowClick?: (row: T) => void
  actions?: (row: T) => React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Search...",
  className,
  onRowClick,
  actions,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [searchTerm, setSearchTerm] = useState("")
  const [filterColumn, setFilterColumn] = useState<keyof T | null>(null)
  const [filterValue, setFilterValue] = useState("")

  const handleSort = (column: keyof T) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const filteredData = data.filter(row => {
    // Search filter
    if (searchTerm) {
      const searchableValues = columns
        .filter(col => col.filterable !== false)
        .map(col => String(row[col.key] || '').toLowerCase())
      
      if (!searchableValues.some(value => value.includes(searchTerm.toLowerCase()))) {
        return false
      }
    }

    // Column filter
    if (filterColumn && filterValue) {
      const value = String(row[filterColumn] || '').toLowerCase()
      if (!value.includes(filterValue.toLowerCase())) {
        return false
      }
    }

    return true
  })

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0
    
    const aValue = a[sortColumn]
    const bValue = b[sortColumn]
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const getSortIcon = (column: keyof T) => {
    if (sortColumn !== column) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4" /> : 
      <ChevronDown className="h-4 w-4" />
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search and filters */}
      <div className="flex items-center justify-between gap-4">
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {columns.filter(col => col.filterable !== false).map(column => (
                <DropdownMenuItem 
                  key={String(column.key)}
                  onClick={() => {
                    setFilterColumn(column.key)
                    setFilterValue("")
                  }}
                >
                  Filter by {column.label}
                </DropdownMenuItem>
              ))}
              {filterColumn && (
                <DropdownMenuItem 
                  onClick={() => {
                    setFilterColumn(null)
                    setFilterValue("")
                  }}
                >
                  Clear filter
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Column filter input */}
      {filterColumn && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Filter by {columns.find(col => col.key === filterColumn)?.label}:
          </span>
          <Input
            placeholder="Enter filter value..."
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="max-w-xs"
          />
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setFilterColumn(null)
              setFilterValue("")
            }}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border/50">
              {columns.map((column) => (
                <TableHead 
                  key={String(column.key)}
                  className={cn(
                    "text-muted-foreground font-medium",
                    column.sortable !== false && "cursor-pointer hover:text-foreground"
                  )}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable !== false && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
              {actions && <TableHead className="w-10"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.length === 0 ? (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (actions ? 1 : 0)} 
                  className="text-center py-8 text-muted-foreground"
                >
                  No data found
                </TableCell>
              </TableRow>
            ) : (
              sortedData.map((row, index) => (
                <TableRow 
                  key={index}
                  className={cn(
                    "hover:bg-muted/30 transition-colors border-b border-border/30",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => (
                    <TableCell key={String(column.key)}>
                      {column.render ? 
                        column.render(row[column.key], row) : 
                        String(row[column.key] || '')
                      }
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {actions(row)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {sortedData.length} of {data.length} results
      </div>
    </div>
  )
}