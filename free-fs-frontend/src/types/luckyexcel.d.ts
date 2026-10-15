/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

declare module 'luckyexcel' {
  const LuckyExcel: {
    transformExcelToLucky: (
      file: File,
      callback: (exportJson: { sheets?: unknown[] }, raw?: string) => void
    ) => void
  }
  export default LuckyExcel
}
