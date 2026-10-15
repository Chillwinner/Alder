/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import type { HomeUsedBytesUnit } from '@/api/home'
import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { cn } from '@/lib/utils'

type ChartStorageGrowthProps = {
  className?: string
  unit: HomeUsedBytesUnit
  onUnitChange: (unit: HomeUsedBytesUnit) => void
}

export function ChartStorageGrowth({
  className,
  unit,
  onUnitChange,
}: ChartStorageGrowthProps) {
  return (
    <ChartAreaInteractive
      unit={unit}
      onUnitChange={onUnitChange}
      className={cn('min-h-0', className)}
    />
  )
}
