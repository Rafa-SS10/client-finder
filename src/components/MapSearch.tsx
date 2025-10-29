import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import type { BusinessResult, BusinessType } from '../types';

interface MapSearchProps {
    onResults: (results: BusinessResult[]) => void;
}

const DEFAULT_CENTER = { lat: 40.4168, lng: -3.7038 }; // Madrid as a neutral default
const DEFAULT_RADIUS = 3000;

const BUSINESS_TYPES: Array<{ label: string; value: BusinessType | '' }> = [
    { label: 'Any', value: '' },
    { label: 'Cafe', value: 'cafe' },
    { label: 'Pharmacy', value: 'pharmacy' },
    { label: 'Gas Station', value: 'gas_station' },
    { label: 'Restaurant', value: 'restaurant' },
    { label: 'Bakery', value: 'bakery' },
    { label: 'Book Store', value: 'book_store' },
    { label: 'Clothing Store', value: 'clothing_store' },
    { label: 'Convenience Store', value: 'convenience_store' },
    { label: 'Dentist', value: 'dentist' },
    { label: 'Doctor', value: 'doctor' },
    { label: 'Electrician', value: 'electrician' },
    { label: 'Gym', value: 'gym' },
    { label: 'Hair Care', value: 'hair_care' },
    { label: 'Hardware Store', value: 'hardware_store' },
    { label: 'Laundry', value: 'laundry' },
    { label: 'Locksmith', value: 'locksmith' },
    { label: 'Pet Store', value: 'pet_store' },
    { label: 'Shoe Store', value: 'shoe_store' },
    { label: 'Supermarket', value: 'supermarket' },
    { label: 'Veterinary Care', value: 'veterinary_care' },
];

export function MapSearch({ onResults }: MapSearchProps) {
    const mapRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);
    const mapInstance = useRef<google.maps.Map | null>(null);
    const circleRef = useRef<google.maps.Circle | null>(null);
    const [radius, setRadius] = useState<number>(DEFAULT_RADIUS);
    const [type, setType] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const loader = useMemo(() => {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
        return new Loader({
            apiKey: apiKey ?? '',
            version: 'weekly',
            libraries: ['places'] as any,
        });
    }, []);

    useEffect(() => {
        let autocomplete: google.maps.places.Autocomplete | null = null;
        let circle: google.maps.Circle | null = null;

        loader
            .importLibrary('maps')
            .then(async () => {
                const { Map } = await google.maps.importLibrary('maps') as google.maps.MapsLibrary;
                const { Marker } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;

                mapInstance.current = new Map(mapRef.current as HTMLDivElement, {
                    center: DEFAULT_CENTER,
                    zoom: 13,
                    mapId: 'DEMO_MAP_ID',
                    disableDefaultUI: false,
                });

                markerRef.current = new Marker({
                    map: mapInstance.current,
                    position: DEFAULT_CENTER,
                });

                circle = new google.maps.Circle({
                    map: mapInstance.current,
                    center: DEFAULT_CENTER,
                    radius,
                    strokeColor: '#2563eb',
                    fillColor: '#3b82f650',
                });
                circleRef.current = circle;

                const { Autocomplete } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
                autocomplete = new Autocomplete(inputRef.current as HTMLInputElement, {
                    types: ['geocode'],
                    fields: ['geometry', 'name', 'formatted_address'],
                });
                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete!.getPlace();
                    if (!place.geometry || !place.geometry.location) return;
                    const loc = place.geometry.location;
                    const latlng = { lat: loc.lat(), lng: loc.lng() };
                    mapInstance.current!.panTo(latlng);
                    markerRef.current!.setPosition(latlng);
                    circle!.setCenter(latlng);
                });

                // Keep circle radius synced
                return () => {
                    circleRef.current = null;
                    circle?.setMap(null);
                    markerRef.current?.setMap(null);
                };
            })
            .catch((e) => setError(String(e)));

        return () => {
            // cleanup listeners if needed
        };
    }, [loader, radius]);

    useEffect(() => {
        if (circleRef.current) {
            circleRef.current.setRadius(radius);
        }
    }, [radius]);

    async function handleSearch() {
        setError(null);
        if (!mapInstance.current) return;
        setLoading(true);
        try {
            const center = (markerRef.current?.getPosition() ?? mapInstance.current.getCenter())!;
            const location = { lat: center.lat(), lng: center.lng() };

            const { PlacesService } = (await google.maps.importLibrary('places')) as google.maps.PlacesLibrary;
            const service = new PlacesService(mapInstance.current);

            async function fetchAllNearby(): Promise<google.maps.places.PlaceResult[]> {
                const collected: google.maps.places.PlaceResult[] = [];
                return await new Promise((resolve, reject) => {
                    const request: google.maps.places.PlaceSearchRequest = {
                        location,
                        radius,
                        type: (type || undefined) as any,
                    };
                    const handlePage = (
                        results: google.maps.places.PlaceResult[] | null,
                        status: google.maps.places.PlacesServiceStatus,
                        pagination?: google.maps.places.PlaceSearchPagination
                    ) => {
                        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                            collected.push(...results);
                            if (pagination && pagination.hasNextPage) {
                                // Per Google docs, nextPage must be called after a short delay (~2s)
                                setTimeout(() => pagination.nextPage(), 1500);
                                return;
                            }
                            resolve(collected);
                        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                            resolve([]);
                        } else {
                            reject(new Error(`Places search failed: ${status}`));
                        }
                    };
                    service.nearbySearch(request, handlePage);
                });
            }

            const nearbyResults = await fetchAllNearby();

            // Fetch details (phone, website) per place id
            const detailed: BusinessResult[] = [];
            for (const place of nearbyResults) {
                if (!place.place_id) continue;
                const details = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
                    service.getDetails(
                        {
                            placeId: place.place_id!,
                            fields: [
                                'place_id',
                                'name',
                                'formatted_address',
                                'geometry.location',
                                'website',
                                'formatted_phone_number',
                                'url',
                                'types',
                            ],
                        },
                        (res, status) => {
                            if (status === google.maps.places.PlacesServiceStatus.OK) resolve(res!);
                            else resolve(null);
                        }
                    );
                });
                if (!details) continue;
                detailed.push({
                    id: details.place_id!,
                    name: details.name || place.name || 'Unknown',
                    address: details.formatted_address || place.vicinity || '',
                    location: {
                        lat: details.geometry?.location?.lat() ?? place.geometry?.location?.lat() ?? 0,
                        lng: details.geometry?.location?.lng() ?? place.geometry?.location?.lng() ?? 0,
                    },
                    phone: details.formatted_phone_number || undefined,
                    website: details.website || undefined,
                    googleMapsUrl: details.url || undefined,
                    type: details.types?.[0],
                });
            }

            onResults(detailed);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="map-search">
            <div className="controls">
                <div className="field">
                    <label>Location</label>
                    <input ref={inputRef} placeholder="Type a city, address, or area" />
                </div>
                <div className="field">
                    <label>Business Type</label>
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        {BUSINESS_TYPES.map((t) => (
                            <option key={t.label} value={t.value}>
                                {t.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field">
                    <label>Radius: {(radius / 1000).toFixed(1)} km</label>
                    <input
                        type="range"
                        min={500}
                        max={10000}
                        step={500}
                        value={radius}
                        onChange={(e) => setRadius(Number(e.target.value))}
                    />
                </div>
                <button className="primary" onClick={handleSearch} disabled={loading}>
                    {loading ? 'Searching…' : 'Search'}
                </button>
            </div>
            {error && <div className="error">{error}</div>}
            <div ref={mapRef} className="map" />
        </div>
    );
}


