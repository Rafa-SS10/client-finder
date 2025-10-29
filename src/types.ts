export type BusinessType =
    | 'cafe'
    | 'restaurant'
    | 'pharmacy'
    | 'gas_station'
    | 'bakery'
    | 'book_store'
    | 'clothing_store'
    | 'convenience_store'
    | 'dentist'
    | 'doctor'
    | 'electrician'
    | 'gym'
    | 'hair_care'
    | 'hardware_store'
    | 'laundry'
    | 'locksmith'
    | 'pet_store'
    | 'shoe_store'
    | 'supermarket'
    | 'veterinary_care';

export interface BusinessResult {
    id: string;
    name: string;
    address: string;
    location: { lat: number; lng: number };
    phone?: string;
    website?: string;
    googleMapsUrl?: string;
    type?: string;
}

export interface SearchParams {
    location: google.maps.LatLngLiteral;
    radiusMeters: number;
    type?: BusinessType | string;
}


