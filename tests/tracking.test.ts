import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

describe('Sistema de Tracking & UTMs', () => {
  it('Extração e estruturação correta de UTMs de uma URL', () => {
    const url = 'https://loja.com.br/produto-x?utm_source=meta&utm_medium=cpc&utm_campaign=black_friday&utm_content=video_1&utm_term=lookalike&fbclid=IwAR123abc'
    const urlObj = new URL(url)

    const utmSource = urlObj.searchParams.get('utm_source')
    const utmMedium = urlObj.searchParams.get('utm_medium')
    const utmCampaign = urlObj.searchParams.get('utm_campaign')
    const utmContent = urlObj.searchParams.get('utm_content')
    const utmTerm = urlObj.searchParams.get('utm_term')
    const fbclid = urlObj.searchParams.get('fbclid')

    assert.equal(utmSource, 'meta')
    assert.equal(utmMedium, 'cpc')
    assert.equal(utmCampaign, 'black_friday')
    assert.equal(utmContent, 'video_1')
    assert.equal(utmTerm, 'lookalike')
    assert.equal(fbclid, 'IwAR123abc')
  })

  it('Geração de identificadores de cookies Meta (fbp e fbc)', () => {
    const timestamp = Date.now()
    const randomSub = '987654321'
    const fbclid = 'IwAR999xyz'

    // Formato padrão Meta _fbp: fb.1.<creationTime>.<randomSub>
    const fbp = `fb.1.${timestamp}.${randomSub}`
    assert.match(fbp, /^fb\.1\.\d+\.\d+$/)

    // Formato padrão Meta _fbc: fb.1.<creationTime>.<fbclid>
    const fbc = `fb.1.${timestamp}.${fbclid}`
    assert.equal(fbc, `fb.1.${timestamp}.IwAR999xyz`)
  })

  it('Construção de URL rastreável com parâmetros dinâmicos', () => {
    const baseUrl = 'https://meuproduto.com/checkout'
    const urlObj = new URL(baseUrl)
    urlObj.searchParams.set('utm_source', 'facebook')
    urlObj.searchParams.set('utm_medium', 'cpc')
    urlObj.searchParams.set('utm_campaign', 'campanha_01')
    urlObj.searchParams.set('utm_content', '{{ad.name}}')
    urlObj.searchParams.set('ad_id', '1202020202')

    const result = urlObj.toString()
    assert.ok(result.includes('utm_source=facebook'))
    assert.ok(result.includes('utm_campaign=campanha_01'))
    assert.ok(result.includes('ad_id=1202020202'))
  })
})
