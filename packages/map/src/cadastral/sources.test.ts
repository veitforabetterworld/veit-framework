import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBwWmtsXyzTileUrl,
  CADASTRAL_SOURCES,
  resolveCadastralSource,
  resolveCadastralTier,
} from './sources.js';

describe('resolveCadastralSource', () => {
  it('resolves Munich to Bavaria', () => {
    assert.equal(resolveCadastralSource(48.137, 11.575)?.id, 'BY');
  });

  it('resolves Cologne to North Rhine-Westphalia', () => {
    assert.equal(resolveCadastralSource(50.937, 6.96)?.id, 'NW');
  });

  it('resolves Stuttgart to Baden-Württemberg', () => {
    assert.equal(resolveCadastralSource(48.775, 9.182)?.id, 'BW');
  });

  it('resolves Berlin city center to Berlin', () => {
    assert.equal(resolveCadastralSource(52.52, 13.405)?.id, 'BE');
  });

  it('resolves Potsdam to Brandenburg, not Berlin', () => {
    assert.equal(resolveCadastralSource(52.39, 13.07)?.id, 'BB');
  });

  it('resolves Hamburg city center to Hamburg', () => {
    assert.equal(resolveCadastralSource(53.551, 9.994)?.id, 'HH');
  });

  it('resolves Lüneburg near Hamburg border to Lower Saxony', () => {
    assert.equal(resolveCadastralSource(53.25, 10.41)?.id, 'NI');
  });

  it('resolves Görlitz on the Saxony border to Saxony', () => {
    assert.equal(resolveCadastralSource(51.15, 14.99)?.id, 'SN');
  });

  it('returns null outside Germany', () => {
    assert.equal(resolveCadastralSource(48.856, 2.352), null);
  });
});

describe('resolveCadastralTier', () => {
  const berlin = CADASTRAL_SOURCES.find((s) => s.id === 'BE')!;
  const brandenburg = CADASTRAL_SOURCES.find((s) => s.id === 'BB')!;
  const bremen = CADASTRAL_SOURCES.find((s) => s.id === 'HB')!;
  const hamburg = CADASTRAL_SOURCES.find((s) => s.id === 'HH')!;

  it('uses Berlin K5 overview below detail zoom', () => {
    assert.equal(resolveCadastralTier(berlin, 12)?.id, 'overview');
    assert.equal(resolveCadastralTier(berlin, 12)?.layers, 'k5_farbe');
    assert.equal(resolveCadastralTier(berlin, 18)?.id, 'detail');
    assert.equal(resolveCadastralTier(berlin, 18)?.layers, 'a_alkis_raster');
  });

  it('uses Brandenburg DTK50 overview below ALKIS detail zoom', () => {
    assert.equal(resolveCadastralTier(brandenburg, 10)?.layers, 'bb_dtk50_farbe');
    assert.match(resolveCadastralTier(brandenburg, 10)?.url ?? '', /mapproxy\/dtk50farbe/);
    assert.equal(resolveCadastralTier(brandenburg, 16)?.id, 'detail');
  });

  it('uses Bremen ABK5 below ALKIS detail zoom', () => {
    assert.equal(resolveCadastralTier(bremen, 12)?.url, 'https://geodienste.bremen.de/ABK_farbig');
    assert.equal(resolveCadastralTier(bremen, 17)?.layers, 'ALKIS');
  });

  it('uses Hamburg Geobasiskarten overview and numeric ALKIS detail layer IDs', () => {
    assert.equal(resolveCadastralTier(hamburg, 12)?.transport, 'wms');
    assert.equal(resolveCadastralTier(hamburg, 12)?.layers, 'geobasiskarten_farbig');
    assert.match(resolveCadastralTier(hamburg, 12)?.url ?? '', /HH_WMS_Geobasiskarten/);
    assert.equal(resolveCadastralTier(hamburg, 17)?.layers, '0,1,4,6,13,18,24,26,28');
  });

  it('uses MV DTK10 overview and ALKIS detail', () => {
    const mv = CADASTRAL_SOURCES.find((s) => s.id === 'MV')!;
    assert.equal(resolveCadastralTier(mv, 10)?.layers, 'mv_dtk10');
    assert.equal(resolveCadastralTier(mv, 17)?.layers, 'adv_alkis_flurstuecke,adv_alkis_gebaeude,adv_alkis_tatsaechliche_nutzung');
  });

  it('uses SH BDD overview and ALKIS detail with default style', () => {
    const sh = CADASTRAL_SOURCES.find((s) => s.id === 'SH')!;
    assert.equal(resolveCadastralTier(sh, 12)?.layers, 'SH_bdd_col');
    assert.equal(resolveCadastralTier(sh, 12)?.styles, 'default');
    assert.equal(resolveCadastralTier(sh, 17)?.layers, 'SH_ALKIS');
    assert.equal(resolveCadastralTier(sh, 17)?.styles, 'default');
  });

  it('keeps detail tier beyond native max zoom for upscaling', () => {
    assert.equal(resolveCadastralTier(berlin, 21)?.id, 'detail');
    assert.equal(resolveCadastralTier(berlin, 21)?.maxNativeZoom, 20);
  });

  it('uses Baden-Württemberg WMTS xyz template with label layer', () => {
    const bw = CADASTRAL_SOURCES.find((s) => s.id === 'BW')!;
    assert.equal(bw.transport, 'wmts_xyz');
    assert.match(bw.url, /ALKIS_Basis/);
    assert.match(bw.url, /GoogleMapsCompatible:\{z\}/);
    assert.match(bw.labelUrl!, /ALKIS_Beschriftung/);
    const built = buildBwWmtsXyzTileUrl('ALKIS_Basis');
    assert.equal(built, bw.url);
  });

  it('returns stable default tier reference for sources without tiers', () => {
    const bw = CADASTRAL_SOURCES.find((s) => s.id === 'BW')!;
    assert.equal(resolveCadastralTier(bw, 14), resolveCadastralTier(bw, 14));
  });

  it('uses RP UEK250 overview for Saarland and ALKIS detail below detail zoom', () => {
    const sl = CADASTRAL_SOURCES.find((s) => s.id === 'SL')!;
    assert.equal(resolveCadastralTier(sl, 10)?.transport, 'wms');
    assert.equal(resolveCadastralTier(sl, 10)?.layers, 'rp_uek250');
    assert.match(resolveCadastralTier(sl, 10)?.url ?? '', /rp_uek250/);
    assert.equal(resolveCadastralTier(sl, 16)?.layers, 'adv_alkis');
    assert.equal(resolveCadastralTier(sl, 16)?.styles, 'schwarz');
  });

  it('uses Saxony DTK product group overview and ALKIS detail without explicit styles', () => {
    const sn = CADASTRAL_SOURCES.find((s) => s.id === 'SN')!;
    assert.equal(resolveCadastralTier(sn, 10)?.layers, 'sn_dtk_pg_color');
    assert.match(resolveCadastralTier(sn, 10)?.url ?? '', /wms_geosn_dtk-pg-color/);
    assert.equal(resolveCadastralTier(sn, 17)?.layers, 'adv_alkis_flurstuecke,adv_alkis_gebaeude,adv_alkis_tatsaechliche_nutzung');
    assert.equal(resolveCadastralTier(sn, 17)?.styles, undefined);
  });

  it('uses Hessen scale-dependent map overview and he_alk detail via GDS WMS', () => {
    const he = CADASTRAL_SOURCES.find((s) => s.id === 'HE')!;
    assert.match(he.url, /gds-srv\.hessen\.de/);
    assert.equal(resolveCadastralTier(he, 12)?.layers, 'wms_he_karten');
    assert.equal(resolveCadastralTier(he, 16)?.layers, 'he_alk');
  });

  it('uses NRW DTK overview and ALKIS detail', () => {
    const nw = CADASTRAL_SOURCES.find((s) => s.id === 'NW')!;
    assert.equal(resolveCadastralTier(nw, 12)?.layers, 'nw_dtk_col');
    assert.equal(resolveCadastralTier(nw, 12)?.url, 'https://www.wms.nrw.de/geobasis/wms_nw_dtk');
    assert.equal(resolveCadastralTier(nw, 17)?.layers, 'adv_alkis_flurstuecke,adv_alkis_gebaeude,adv_alkis_tatsaechliche_nutzung');
    assert.equal(resolveCadastralTier(nw, 17)?.styles, 'Farbe,Farbe,Farbe');
  });

  it('uses RP UEK250 overview and Liegenschaften detail via direct WMS', () => {
    const rp = CADASTRAL_SOURCES.find((s) => s.id === 'RP')!;
    assert.match(rp.url, /geo5\.service24\.rlp\.de/);
    assert.equal(resolveCadastralTier(rp, 12)?.layers, 'rp_uek250');
    assert.match(resolveCadastralTier(rp, 12)?.url ?? '', /geo4\.service24\.rlp\.de/);
    assert.equal(resolveCadastralTier(rp, 16)?.layers, 'Flurstueck,GebaeudeBauwerke,Nutzung');
    assert.equal(resolveCadastralTier(rp, 16)?.styles, 'default,default,default');
  });

  it('uses Berlin K5 and ALKIS with mandatory empty STYLES', () => {
    const be = CADASTRAL_SOURCES.find((s) => s.id === 'BE')!;
    assert.equal(resolveCadastralTier(be, 12)?.layers, 'k5_farbe');
    assert.equal(resolveCadastralTier(be, 12)?.styles, '');
    assert.equal(resolveCadastralTier(be, 18)?.layers, 'a_alkis_raster');
  });

  it('uses NI DTK50 overview and ALKIS detail', () => {
    const ni = CADASTRAL_SOURCES.find((s) => s.id === 'NI')!;
    assert.equal(resolveCadastralTier(ni, 12)?.layers, 'ni_dtk50_farbe');
    assert.equal(resolveCadastralTier(ni, 17)?.layers, 'ALKIS');
  });

  it('uses ST TUEK250 overview and ALKIS detail', () => {
    const st = CADASTRAL_SOURCES.find((s) => s.id === 'ST')!;
    const th = CADASTRAL_SOURCES.find((s) => s.id === 'TH')!;
    assert.equal(resolveCadastralTier(st, 12)?.layers, 'TUEK_250_col');
    assert.match(resolveCadastralTier(st, 12)?.url ?? '', /DTK_WMS_OpenData/);
    assert.equal(resolveCadastralTier(st, 17)?.layers, 'adv_alkis_flurstuecke,adv_alkis_gebaeude,adv_alkis_tatsaechliche_nutzung');
    assert.equal(resolveCadastralTier(th, 12)?.layers, 'th_dtk');
    assert.match(resolveCadastralTier(th, 12)?.url ?? '', /geobasis\/UEK/);
    assert.equal(resolveCadastralTier(th, 16)?.styles, 'default,default,default,default,default,default');
  });

  it('uses BW Basiskarte WMTS overview below ALKIS native zoom', () => {
    const bw = CADASTRAL_SOURCES.find((s) => s.id === 'BW')!;
    assert.equal(resolveCadastralTier(bw, 12)?.transport, 'wmts_xyz');
    assert.equal(resolveCadastralTier(bw, 12)?.layers, 'Basiskarte');
    assert.match(resolveCadastralTier(bw, 12)?.url ?? '', /WMTS_LGL-BW_Basiskarte/);
    assert.equal(resolveCadastralTier(bw, 14)?.transport, 'wmts_xyz');
    assert.equal(resolveCadastralTier(bw, 14)?.layers, 'ALKIS_Basis');
  });
});
