"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

export type PickedAddress = {
  formattedAddress: string;
  placeId: string;
  latitude: number;
  longitude: number;
};

type Props = {
  value: PickedAddress | null;
  onChange: (next: PickedAddress | null) => void;
  countryRestriction?: string; // ISO 3166-1 alpha-2, defaults to "ng"
  placeholder?: string;
  required?: boolean;
  // Optional manual-entry fallback if the API key is missing. When provided,
  // the picker degrades to a plain textarea that writes to formattedAddress.
  allowManualFallback?: boolean;
};

const NIGERIA_CENTER = { lat: 9.082, lng: 8.6753 };

export function GooglePlacesPicker(props: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    // Picker can't render without an API key. Either fall back to a plain
    // textarea (degraded UX) or show a setup hint to the developer.
    return <MissingApiKeyFallback {...props} />;
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places", "geocoding"]}>
      <PickerInner {...props} />
    </APIProvider>
  );
}

function PickerInner({
  value,
  onChange,
  countryRestriction = "ng",
  placeholder = "Search your delivery address",
  required,
}: Props) {
  const placesLib = useMapsLibrary("places");
  const geocodingLib = useMapsLibrary("geocoding");

  const [query, setQuery] = useState(value?.formattedAddress ?? "");
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const debounceRef = useRef<number | null>(null);

  // Reset the local query when the parent clears the value (e.g. form reset)
  useEffect(() => {
    if (!value) setQuery("");
    else if (value.formattedAddress !== query) setQuery(value.formattedAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.placeId]);

  const autocompleteService = useMemo(() => {
    if (!placesLib) return null;
    return new placesLib.AutocompleteService();
  }, [placesLib]);

  const placesService = useMemo(() => {
    if (!placesLib) return null;
    // PlacesService requires an attached element; an off-DOM div is fine.
    return new placesLib.PlacesService(document.createElement("div"));
  }, [placesLib]);

  const geocoder = useMemo(() => {
    if (!geocodingLib) return null;
    return new geocodingLib.Geocoder();
  }, [geocodingLib]);

  const ensureToken = useCallback(() => {
    if (!placesLib) return null;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, [placesLib]);

  // Debounced prediction fetcher
  const fetchPredictions = useCallback(
    (input: string) => {
      if (!autocompleteService || !input.trim()) {
        setPredictions([]);
        return;
      }
      const token = ensureToken();
      autocompleteService.getPlacePredictions(
        {
          input,
          sessionToken: token ?? undefined,
          componentRestrictions: countryRestriction
            ? { country: countryRestriction }
            : undefined,
        },
        (results) => {
          setPredictions(results ?? []);
        },
      );
    },
    [autocompleteService, countryRestriction, ensureToken],
  );

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => fetchPredictions(v), 200);
    // If user starts editing, clear the selected structured value so the
    // form can't submit a stale lat/lng tied to an outdated query.
    if (value) onChange(null);
  }

  const selectPrediction = useCallback(
    (p: google.maps.places.AutocompletePrediction) => {
      if (!placesService) return;
      setBusy(true);
      setOpen(false);
      placesService.getDetails(
        {
          placeId: p.place_id,
          fields: ["formatted_address", "geometry", "place_id"],
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (place, status) => {
          setBusy(false);
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place ||
            !place.geometry?.location
          ) {
            return;
          }
          // Start a new session token after a successful selection (billing).
          sessionTokenRef.current = null;
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const next: PickedAddress = {
            formattedAddress: place.formatted_address ?? p.description,
            placeId: place.place_id ?? p.place_id,
            latitude: lat,
            longitude: lng,
          };
          setQuery(next.formattedAddress);
          onChange(next);
        },
      );
    },
    [placesService, onChange],
  );

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!geocoder) return;
      setBusy(true);
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        setBusy(false);
        if (status !== "OK" || !results || !results[0]) return;
        const r = results[0];
        const next: PickedAddress = {
          formattedAddress: r.formatted_address,
          placeId: r.place_id,
          latitude: lat,
          longitude: lng,
        };
        setQuery(next.formattedAddress);
        onChange(next);
      });
    },
    [geocoder, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type="text"
          className="input"
          placeholder={placeholder}
          value={query}
          onChange={onInputChange}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          autoComplete="off"
          required={required && !value}
          aria-busy={busy || undefined}
        />
        {open && predictions.length > 0 && (
          <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white shadow-lg">
            {predictions.map((p) => (
              <li key={p.place_id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-ink-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectPrediction(p)}
                >
                  <span className="font-medium">
                    {p.structured_formatting?.main_text ?? p.description}
                  </span>
                  {p.structured_formatting?.secondary_text && (
                    <span className="ml-1 text-xs text-ink-500">
                      {p.structured_formatting.secondary_text}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <MapPreview value={value} onMarkerDragEnd={reverseGeocode} />

      {value && (
        <p className="text-xs text-ink-500">
          Drag the pin to fine-tune. We&apos;ll deliver to:{" "}
          <span className="font-medium text-ink-700">{value.formattedAddress}</span>
        </p>
      )}
    </div>
  );
}

function MapPreview({
  value,
  onMarkerDragEnd,
}: {
  value: PickedAddress | null;
  onMarkerDragEnd: (lat: number, lng: number) => void;
}) {
  const center = value
    ? { lat: value.latitude, lng: value.longitude }
    : NIGERIA_CENTER;

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200">
      <div className="h-56 w-full">
        <Map
          mapId="upclo-checkout-picker"
          defaultCenter={center}
          defaultZoom={value ? 16 : 6}
          gestureHandling="cooperative"
          disableDefaultUI
        >
          {value && (
            <>
              <MapRecenterer lat={value.latitude} lng={value.longitude} />
              <AdvancedMarker
                position={center}
                draggable
                onDragEnd={(e) => {
                  const lat = e.latLng?.lat();
                  const lng = e.latLng?.lng();
                  if (typeof lat === "number" && typeof lng === "number") {
                    onMarkerDragEnd(lat, lng);
                  }
                }}
              />
            </>
          )}
        </Map>
      </div>
    </div>
  );
}

function MapRecenterer({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat, lng });
    if ((map.getZoom() ?? 0) < 14) map.setZoom(16);
  }, [map, lat, lng]);
  return null;
}

function MissingApiKeyFallback({ value, onChange, placeholder, required }: Props) {
  return (
    <div className="space-y-1">
      <textarea
        className="input min-h-[100px]"
        placeholder={placeholder ?? "Street, city, postal code, country"}
        required={required}
        value={value?.formattedAddress ?? ""}
        onChange={(e) =>
          onChange(
            e.target.value
              ? {
                  formattedAddress: e.target.value,
                  placeId: "",
                  latitude: 0,
                  longitude: 0,
                }
              : null,
          )
        }
      />
      <p className="text-xs text-amber-600">
        Map picker disabled: <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> is not
        set. Falling back to free-text entry &mdash; Shipbubble may reject vague
        addresses.
      </p>
    </div>
  );
}
