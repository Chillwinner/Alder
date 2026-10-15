/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Workbook } from '@fortune-sheet/react'
import '@fortune-sheet/react/dist/index.css'
import LuckyExcel from 'luckyexcel'

type ExcelPreviewProps = {
  blob: Blob
  fileName: string
  kind: 'excel' | 'csv'
}

type FortuneSheetData = {
  name: string
  celldata?: { r: number; c: number; v: { v: string; m: string } }[]
}

const MIN_ROWS = 84
const MIN_COLS = 60

function padMatrix(data: unknown[][], rows: number, cols: number): unknown[][] {
  const next = data.map((row) => {
    const cells = Array.isArray(row) ? [...row] : []
    while (cells.length < cols) cells.push(null)
    return cells
  })
  while (next.length < rows) next.push(Array.from({ length: cols }, () => null))
  return next
}

function expandSheets(sheets: unknown[]): unknown[] {
  return sheets.map((raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const sheet = raw as Record<string, unknown>
    const cells = Array.isArray(sheet.celldata) ? (sheet.celldata as { r?: number; c?: number }[]) : []
    const usedRows = cells.reduce((max, cell) => Math.max(max, (cell.r ?? 0) + 1), 0)
    const usedCols = cells.reduce((max, cell) => Math.max(max, (cell.c ?? 0) + 1), 0)
    const data = Array.isArray(sheet.data) ? (sheet.data as unknown[][]) : null
    const dataRows = data?.length ?? 0
    const dataCols = data?.[0]?.length ?? 0
    const row = Math.max(Number(sheet.row) || 0, usedRows, dataRows, MIN_ROWS)
    const column = Math.max(Number(sheet.column) || 0, usedCols, dataCols, MIN_COLS)
    return {
      ...sheet,
      row,
      column,
      ...(data ? { data: padMatrix(data, row, column) } : {}),
    }
  })
}

function csvToSheets(text: string): FortuneSheetData[] {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const celldata: NonNullable<FortuneSheetData['celldata']> = []
  rows.forEach((line, rowIndex) => {
    if (line.length === 0) return
    line.split(',').forEach((value, columnIndex) => {
      celldata.push({
        r: rowIndex,
        c: columnIndex,
        v: { v: value, m: value },
      })
    })
  })
  return [{ name: 'Sheet1', celldata }]
}

async function isZipBlob(blob: Blob): Promise<boolean> {
  const header = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
  return header[0] === 0x50 && header[1] === 0x4b
}

function transformExcel(file: File): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), 20000)
    try {
      LuckyExcel.transformExcelToLucky(file, (exportJson) => {
        window.clearTimeout(timer)
        const sheets = exportJson?.sheets
        if (!Array.isArray(sheets) || sheets.length === 0) {
          reject(new Error('empty'))
          return
        }
        resolve(sheets)
      })
    } catch (error) {
      window.clearTimeout(timer)
      reject(error)
    }
  })
}

export function ExcelPreview({ blob, fileName, kind }: ExcelPreviewProps) {
  const { t } = useTranslation('common')
  const boxRef = useRef<HTMLDivElement>(null)
  const [sheets, setSheets] = useState<unknown[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSheets(null)
    setError(null)

    const load = async () => {
      try {
        if (kind === 'csv') {
          const next = expandSheets(csvToSheets(await blob.text()))
          if (!cancelled) setSheets(next)
          return
        }
        if (!(await isZipBlob(blob))) {
          if (!cancelled) setError(t('preview.excelXlsOnly'))
          return
        }
        const file = new File([blob], fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const next = expandSheets(await transformExcel(file))
        if (!cancelled) setSheets(next)
      } catch {
        if (!cancelled) setError(t('preview.loadFailed'))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [blob, fileName, kind, t])

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const update = () => {
      const w = Math.round(el.clientWidth)
      const h = Math.round(el.clientHeight)
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [sheets, error])

  useEffect(() => {
    if (!sheets || error) {
      setReady(false)
      return
    }
    const timer = window.setTimeout(() => setReady(true), 480)
    return () => {
      window.clearTimeout(timer)
      setReady(false)
    }
  }, [sheets, error])

  useEffect(() => {
    if (!ready || size.w < 8 || size.h < 8) return
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
    return () => window.cancelAnimationFrame(frame)
  }, [ready, size.w, size.h])

  if (error) {
    return (
      <div className='text-destructive flex h-full items-center justify-center text-sm'>
        {error}
      </div>
    )
  }

  if (!sheets) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center text-sm'>
        {t('loading')}
      </div>
    )
  }

  return (
    <div ref={boxRef} className='relative h-full min-h-0 w-full overflow-hidden rounded-md bg-surface'>
      {ready && size.w > 8 && size.h > 8 ? (
        <div
          className='absolute inset-0 [&_.fortune-container]:h-full [&_.fortune-container]:w-full [&_.fortune-sheet-container]:h-full [&_.fortune-sheet-container]:w-full'
          style={{ width: size.w, height: size.h }}
        >
          <Workbook
            data={sheets as never}
            row={MIN_ROWS}
            column={MIN_COLS}
            showToolbar={false}
            showFormulaBar={false}
            allowEdit={false}
          />
        </div>
      ) : null}
    </div>
  )
}
