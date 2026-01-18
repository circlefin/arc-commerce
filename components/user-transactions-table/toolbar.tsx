/**
 * Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useMemo } from "react";
import { Table } from "@tanstack/react-table";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, XIcon } from "lucide-react";
import { format } from "date-fns";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
}

export function DataTableToolbar<TData>({ table }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  // read from the table state. the value is an array: [Date | undefined, Date | undefined]
  const dateFilterValue = table.getColumn("date")?.getFilterValue() as [Date | undefined, Date | undefined] | undefined;

  // translate the array into a DateRange object for the Calendar component.
  const selectedDateRange: DateRange | undefined = useMemo(() => {
    if (!dateFilterValue) return undefined;
    const [from, to] = dateFilterValue;
    return { from, to };
  }, [dateFilterValue]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-4">
        {/* shadcn date range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className="w-[280px] justify-start text-left font-normal h-9"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDateRange?.from ? (
                selectedDateRange.to ? (
                  <>
                    {format(selectedDateRange.from, "LLL dd, y")} -{" "}
                    {format(selectedDateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(selectedDateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={selectedDateRange?.from}
              selected={selectedDateRange}
              // translate the DateRange object from the Calendar back into an array for the table state.
              onSelect={(newDateRange) => {
                table.getColumn("date")?.setFilterValue(
                  newDateRange ? [newDateRange.from, newDateRange.to] : undefined
                );
              }}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Status Select */}
        <Select
          value={(table.getColumn("status")?.getFilterValue() as string) ?? ""}
          onValueChange={(value) =>
            table.getColumn("status")?.setFilterValue(value || undefined)
          }
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Filter by Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        {/* Network Select */}
        <Select
          value={(table.getColumn("network")?.getFilterValue() as string) ?? ""}
          onValueChange={(value) =>
            table.getColumn("network")?.setFilterValue(value || undefined)
          }
        >
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Filter by Network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Ethereum">Ethereum</SelectItem>
            <SelectItem value="Polygon">Polygon</SelectItem>
            <SelectItem value="Base">Base</SelectItem>
          </SelectContent>
        </Select>

        {isFiltered && (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-9 px-2 lg:px-3"
          >
            Reset
            <XIcon className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}