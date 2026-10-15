/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getProgressMonth, type ProgressMonth } from '@/api/progress'
import { Button } from '@/components/ui/button'
import { HubLoading } from '@/components/collab/hub-shell'
import { cn } from '@/lib/utils'

export default function ProgressMonth() {
  const { t } = useTranslation('progress')
  const { slug = '' } = useParams()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tip, setTip] = useState<string | null>(null)
  const today = now.getDate()
  const isThisMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const days = new Date(year, month, 0).getDate()

  const query = useQuery({
    queryKey: ['progress-month', slug, year, month],
    queryFn: () => getProgressMonth(year, month),
  })
  const data = query.data
  const cellMap = useMemo(() => {
    const map = new Map<string, ProgressMonth['cells'][number]>()
    for (const cell of data?.cells ?? []) {
      map.set(`${cell.userId}-${cell.day}`, cell)
    }
    return map
  }, [data])

  const shift = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1)
    setYear(next.getFullYear())
    setMonth(next.getMonth() + 1)
    setTip(null)
  }

  return (
    <>
      <div className='pg-head'>
        <div>
          <h1>{t('month')}</h1>
          <p className='pg-sub'>{t('monthHint')}</p>
        </div>
        <div className='flex items-center gap-2'>
          <Button variant='outline' className='h-11 w-11' onClick={() => shift(-1)}>
            <ChevronLeft className='size-5' />
          </Button>
          <div className='min-w-36 text-center text-lg font-semibold'>
            {year}{t('year')}{month}{t('monthUnit')}
          </div>
          <Button variant='outline' className='h-11 w-11' onClick={() => shift(1)}>
            <ChevronRight className='size-5' />
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <HubLoading />
      ) : (
        <div className='pg-month'>
          <table>
            <thead>
              <tr>
                <th>{t('people')}</th>
                {Array.from({ length: days }, (_, i) => (
                  <th key={i} className={cn(isThisMonth && i + 1 === today && 'bg-sky-50 dark:bg-sky-950/30')}>
                    {i + 1}
                  </th>
                ))}
                <th>{t('doneDays')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.people ?? []).map((person) => {
                let done = 0
                return (
                  <tr key={person.userId}>
                    <td>{person.name}</td>
                    {Array.from({ length: days }, (_, i) => {
                      const cell = cellMap.get(`${person.userId}-${i + 1}`)
                      if (cell?.count) done += 1
                      return (
                        <td
                          key={i}
                          className={cn(isThisMonth && i + 1 === today && 'bg-sky-50 dark:bg-sky-950/30')}
                          onClick={() =>
                            setTip(cell?.titles?.length ? `${person.name} · ${i + 1}${t('dayUnit')}：${cell.titles.join('、')}` : null)
                          }
                        >
                          <div
                            className={cn(
                              'pg-dot',
                              cell?.approved && 'is-on',
                              cell?.pending && !cell.approved && 'is-wait',
                              isThisMonth && i + 1 === today && 'is-today'
                            )}
                          />
                        </td>
                      )
                    })}
                    <td>{done}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {tip ? <p className='mt-5 text-base text-muted-foreground'>{tip}</p> : <p className='mt-5 text-base text-muted-foreground'>{t('monthClick')}</p>}
    </>
  )
}
