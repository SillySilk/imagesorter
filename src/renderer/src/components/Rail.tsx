import React from 'react'
import { useApp } from '../context/AppContext'
import { IcGrid, IcAperture, IcFilm, IcCpu, IcHistory, IcSettings } from './Icons'

interface Props {
  onOpenSettings: () => void
}

const items = [
  { k: 'browse' as const, Icon: IcGrid, label: 'Browser' },
  { k: 'sort' as const, Icon: IcAperture, label: 'Cull / Sort' },
  { k: 'film' as const, Icon: IcFilm, label: 'Film & Filters' },
  { k: 'utils' as const, Icon: IcCpu, label: 'Utilities' },
  { k: 'history' as const, Icon: IcHistory, label: 'History' },
]

export default function Rail({ onOpenSettings }: Props) {
  const { state, dispatch } = useApp()

  return (
    <div className="rail">
      {items.map(({ k, Icon, label }) => (
        <button
          key={k}
          title={label}
          className={`rail-btn${state.railTab === k ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_RAIL_TAB', payload: k })}
        >
          <Icon />
        </button>
      ))}
      <div className="rail-spacer"></div>
      <button className="rail-btn" title="Preferences" onClick={onOpenSettings}>
        <IcSettings />
      </button>
    </div>
  )
}
