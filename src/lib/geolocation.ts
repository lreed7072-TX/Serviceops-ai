/**
 * Client-side geolocation utilities for field tech GPS features.
 */

export type GeoPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

/**
 * Get the current GPS position.
 * Returns null if geolocation is unavailable or denied.
 */
export function getCurrentPosition(timeout = 10000): Promise<GeoPosition | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 }
    );
  });
}

/**
 * Build a Google Maps directions URL from current location to a destination address.
 */
export function getDirectionsUrl(address: string): string {
  const encoded = encodeURIComponent(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

/**
 * Build a Google Maps URL for specific coordinates.
 */
export function getMapUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
