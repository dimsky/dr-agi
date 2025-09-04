"use client"

import * as React from "react"
import { format } from "date-fns"
import { zhCN } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  disabled = false,
  className,
}: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "yyyy-MM-dd", { locale: zhCN }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto min-w-[20rem] p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          locale={zhCN}
          className="rounded-md border"
        />
      </PopoverContent>
    </Popover>
  )
}

interface DateRangePickerProps {
  from?: Date
  to?: Date
  onRangeChange?: (range: { from?: Date; to?: Date }) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DateRangePicker({
  from,
  to,
  onRangeChange,
  placeholder = "选择日期范围",
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [range, setRange] = React.useState<DateRange | undefined>({
    from,
    to,
  })

  React.useEffect(() => {
    setRange({ from, to })
  }, [from, to])

  const handleRangeChange = (newRange: DateRange | undefined) => {
    setRange(newRange)
    onRangeChange?.({
      from: newRange?.from,
      to: newRange?.to,
    })
  }

  return (
    <div className={cn("grid w-full gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !range && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from ? (
              range.to ? (
                <>
                  {format(range.from, "yyyy-MM-dd", { locale: zhCN })} -{" "}
                  {format(range.to, "yyyy-MM-dd", { locale: zhCN })}
                </>
              ) : (
                format(range.from, "yyyy-MM-dd", { locale: zhCN })
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto min-w-[36rem] p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={handleRangeChange}
            numberOfMonths={2}
            locale={zhCN}
            className="rounded-md border"
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}