/*
 * Alder — derivative of Free-FS (https://github.com/dromara/free-fs).
 * Licensed under the Apache License, Version 2.0. See LICENSE and NOTICE.
 */

import { NavLink, Outlet, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './progress.css'

export default function ProgressLayout() {
  const { t } = useTranslation('progress')
  const { slug = '' } = useParams()
  const base = `/w/${slug}/progress`
  return (
    <div className='pg-shell'>
      <nav className='pg-rail'>
        <NavLink to={base} end className={({ isActive }) => (isActive ? 'is-on' : undefined)}>
          {t('overview')}
        </NavLink>
        <NavLink to={`${base}/month`} className={({ isActive }) => (isActive ? 'is-on' : undefined)}>
          {t('month')}
        </NavLink>
        <NavLink to={`${base}/mine`} className={({ isActive }) => (isActive ? 'is-on' : undefined)}>
          {t('mine')}
        </NavLink>
      </nav>
      <div className='pg-main'>
        <Outlet />
      </div>
    </div>
  )
}
