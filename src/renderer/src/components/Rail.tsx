import React from 'react'
import { useApp } from '../context/AppContext'
import { IcAperture, IcCpu, IcSettings } from './Icons'

interface Props {
  onOpenSettings: () => void
}

const items = [
  { k: 'sort' as const, Icon: IcAperture, label: 'Cull / Sort' },
  { k: 'utils' as const, Icon: IcCpu, label: 'Utilities' },
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
