import { describe, it, expect } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import JsonEditor from '../components/JsonEditor'
import { MusicData } from '../types'

describe('Diff 模式渲染', () => {
  const baseData: MusicData = {
    global_dimension: {
      description: 'Hello',
      fact_keywords: {},
      highlights: {},
      lowlights: {}
    },
    section_dimension: []
  }

  it('在 Diff 开启且参考相等时显示 ✓，不显示缺失告警', () => {
    const map = { 'global_dimension.description': 'Hello' }
    render(
      <JsonEditor
        data={baseData}
        onChange={() => {}}
        translationMap={map}
        compareMode={'dual'}
        diffModeEnabled={true}
      />
    )
    expect(screen.getByText('✓')).toBeDefined()
    expect(screen.queryByText('Missing Reference')).toBeNull()
  })

  it('在 Diff 开启且参考不等时显示 ≠', () => {
    const map = { 'global_dimension.description': '你好' }
    render(
      <JsonEditor
        data={baseData}
        onChange={() => {}}
        translationMap={map}
        compareMode={'dual'}
        diffModeEnabled={true}
      />
    )
    expect(screen.getByText('≠')).toBeDefined()
  })

  it('在 Diff 开启且无参考时不显示缺失告警', () => {
    render(
      <JsonEditor
        data={baseData}
        onChange={() => {}}
        translationMap={{}}
        compareMode={'dual'}
        diffModeEnabled={true}
      />
    )
    expect(screen.queryByText('Missing Reference')).toBeNull()
  })
})

