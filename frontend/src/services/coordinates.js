var _GCJ_A = 6378245.0;
var _GCJ_EE = 0.006693421622965943;

const _outOfChina = (lng, lat) => {
  return !(72.004 <= lng && lng <= 137.8347 && 0.8293 <= lat && lat <= 55.8271);
};

const _transformLat = (x, y) => {
  var r =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  r +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  r +=
    ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  r +=
    ((160.0 * Math.sin((y / 12.0) * Math.PI) +
      320.0 * Math.sin((y * Math.PI) / 30.0)) *
      2.0) /
    3.0;
  return r;
};

const _transformLng = (x, y) => {
  var r =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  r +=
    ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) *
      2.0) /
    3.0;
  r +=
    ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) *
      2.0) /
    3.0;
  r +=
    ((150.0 * Math.sin((x / 12.0) * Math.PI) +
      300.0 * Math.sin((x / 30.0) * Math.PI)) *
      2.0) /
    3.0;
  return r;
};

/**
 * Convert a WGS-84 coordinate pair to GCJ-02 (火星坐标).
 * Returns { lat, lng } in GCJ-02.  Coordinates outside mainland China
 * are returned as-is (no offset applies).
 */
export const wgs84ToGcj02 = (lng, lat) => {
  if (_outOfChina(lng, lat)) return { lng: lng, lat: lat };

  var dx = _transformLng(lng - 105.0, lat - 35.0);
  var dy = _transformLat(lng - 105.0, lat - 35.0);
  var radLat = (lat / 180.0) * Math.PI;
  var magic = Math.sin(radLat);
  magic = 1 - _GCJ_EE * magic * magic;
  var sqrtMagic = Math.sqrt(magic);
  dx = (dx * 180.0) / ((_GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  dy =
    (dy * 180.0) / (((_GCJ_A * (1 - _GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  return { lng: lng + dx, lat: lat + dy };
};
