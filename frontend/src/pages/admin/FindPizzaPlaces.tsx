import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Phone,
  Globe,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api';
import Card, { CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import LoadingScreen from '../../components/ui/LoadingScreen';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const libraries: ('places')[] = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '400px',
};

const defaultCenter = {
  lat: 39.0997, // Kansas City
  lng: -94.5786,
};

interface PlaceResult {
  place_id: string;
  name: string;
  vicinity: string;
  geometry: {
    location: google.maps.LatLng;
  };
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  formatted_phone_number?: string;
  website?: string;
  photos?: google.maps.places.PlacePhoto[];
}

export default function FindPizzaPlaces() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [showOrderSummary, setShowOrderSummary] = useState(true);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [searchAddress, setSearchAddress] = useState('');
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // Fetch report data
  const { data: reportResponse, isLoading: reportLoading } = useQuery({
    queryKey: ['report', eventId],
    queryFn: () => api.getReport(eventId!),
    enabled: !!eventId,
  });

  const report = reportResponse?.data;

  // Search for nearby pizza places
  const searchNearbyPizzaPlaces = useCallback(
    (location: google.maps.LatLngLiteral) => {
      if (!map) return;

      setIsSearching(true);
      const service = new google.maps.places.PlacesService(map);

      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(location.lat, location.lng),
        radius: 8000, // 8km radius
        keyword: 'pizza',
        type: 'restaurant',
      };

      service.nearbySearch(request, (results, status) => {
        setIsSearching(false);
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          // Get detailed info for each place
          const detailedPlaces: PlaceResult[] = [];
          let completed = 0;

          results.slice(0, 10).forEach((place) => {
            if (place.place_id) {
              service.getDetails(
                {
                  placeId: place.place_id,
                  fields: [
                    'place_id',
                    'name',
                    'vicinity',
                    'geometry',
                    'rating',
                    'user_ratings_total',
                    'opening_hours',
                    'formatted_phone_number',
                    'website',
                    'photos',
                  ],
                },
                (details, detailStatus) => {
                  completed++;
                  if (detailStatus === google.maps.places.PlacesServiceStatus.OK && details) {
                    detailedPlaces.push(details as PlaceResult);
                  }
                  if (completed === Math.min(results.length, 10)) {
                    // Sort by rating
                    detailedPlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                    setPlaces(detailedPlaces);
                  }
                }
              );
            }
          });

          if (results.length === 0) {
            setPlaces([]);
          }
        } else {
          setPlaces([]);
        }
      });
    },
    [map]
  );

  // Get user's current location
  const getCurrentLocation = useCallback(() => {
    setLocationError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          if (map) {
            map.panTo(location);
            map.setZoom(13);
          }
          searchNearbyPizzaPlaces(location);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError('Unable to get your location. Please enter an address.');
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser.');
    }
  }, [map, searchNearbyPizzaPlaces]);

  // Auto-detect location on load
  useEffect(() => {
    if (isLoaded && map && !userLocation) {
      getCurrentLocation();
    }
  }, [isLoaded, map, userLocation, getCurrentLocation]);

  // Handle address search
  const handleAddressSearch = useCallback(() => {
    if (!map || !searchAddress.trim()) return;

    setLocationError(null);
    setIsSearching(true);

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results && results[0]) {
        const location = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        };
        setUserLocation(location);
        map.panTo(location);
        map.setZoom(13);
        searchNearbyPizzaPlaces(location);
      } else {
        setIsSearching(false);
        setLocationError('Could not find that address. Please try again.');
      }
    });
  }, [map, searchAddress, searchNearbyPizzaPlaces]);

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  if (reportLoading) {
    return <LoadingScreen />;
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-text">Find Pizza Places</h1>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-700">Failed to load Google Maps</p>
              <p className="text-sm text-red-600">Please check your API key configuration.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text">Find Pizza Places</h1>
          {report?.event && <p className="text-text-muted">{report.event.name}</p>}
        </div>
      </div>

      {/* Order Summary (Collapsible) */}
      {report && report.pizzaOrders.length > 0 && (
        <Card>
          <CardHeader>
            <button
              onClick={() => setShowOrderSummary(!showOrderSummary)}
              className="flex items-center justify-between w-full"
            >
              <CardTitle className="text-base">Order Summary</CardTitle>
              {showOrderSummary ? (
                <ChevronUp className="w-5 h-5 text-text-muted" />
              ) : (
                <ChevronDown className="w-5 h-5 text-text-muted" />
              )}
            </button>
          </CardHeader>
          {showOrderSummary && (
            <CardContent>
              <div className="space-y-2">
                {report.pizzaOrders.map((pizza, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span>
                      {pizza.quantity}x {pizza.name}
                    </span>
                    <span className="text-text-muted">{pizza.slicesRequested} slices</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                  <span>Total</span>
                  <span>{report.totalPizzas} pizzas</span>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Location Search */}
      <Card>
        <CardContent className="py-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter address to search nearby..."
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
              />
            </div>
            <Button onClick={handleAddressSearch} disabled={!isLoaded || isSearching}>
              <MapPin className="w-4 h-4 mr-1" />
              Search
            </Button>
            <Button variant="outline" onClick={getCurrentLocation} disabled={!isLoaded || isSearching}>
              <Navigation className="w-4 h-4" />
            </Button>
          </div>
          {locationError && (
            <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {locationError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Google Map */}
      <Card className="overflow-hidden">
        {!isLoaded ? (
          <div className="h-[400px] flex items-center justify-center bg-gray-100">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={userLocation || defaultCenter}
            zoom={userLocation ? 13 : 10}
            onLoad={onMapLoad}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
            }}
          >
            {/* User location marker */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 10,
                  fillColor: '#4F46E5',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 3,
                }}
                title="Your location"
              />
            )}

            {/* Pizza place markers */}
            {places.map((place) => (
              <Marker
                key={place.place_id}
                position={{
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                }}
                onClick={() => setSelectedPlace(place)}
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                }}
              />
            ))}

            {/* Info Window */}
            {selectedPlace && (
              <InfoWindow
                position={{
                  lat: selectedPlace.geometry.location.lat(),
                  lng: selectedPlace.geometry.location.lng(),
                }}
                onCloseClick={() => setSelectedPlace(null)}
              >
                <div className="p-1 max-w-[250px]">
                  <h3 className="font-semibold text-gray-900">{selectedPlace.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{selectedPlace.vicinity}</p>
                  {selectedPlace.rating && (
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm">
                        {selectedPlace.rating} ({selectedPlace.user_ratings_total})
                      </span>
                    </div>
                  )}
                  {selectedPlace.opening_hours && (
                    <p
                      className={`text-sm mt-1 ${
                        selectedPlace.opening_hours.open_now ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {selectedPlace.opening_hours.open_now ? 'Open Now' : 'Closed'}
                    </p>
                  )}
                  {selectedPlace.formatted_phone_number && (
                    <a
                      href={`tel:${selectedPlace.formatted_phone_number}`}
                      className="text-sm text-primary hover:underline block mt-1"
                    >
                      {selectedPlace.formatted_phone_number}
                    </a>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </Card>

      {/* Loading indicator for search */}
      {isSearching && (
        <div className="flex items-center justify-center gap-2 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Searching for pizza places...</span>
        </div>
      )}

      {/* Pizza Places List */}
      {places.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-text mb-3">Nearby Pizza Places</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {places.map((place) => (
              <Card
                key={place.place_id}
                className={`cursor-pointer transition-all ${
                  selectedPlace?.place_id === place.place_id
                    ? 'ring-2 ring-primary'
                    : 'hover:shadow-md'
                }`}
                onClick={() => {
                  setSelectedPlace(place);
                  map?.panTo({
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng(),
                  });
                }}
              >
                <CardContent className="py-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-text truncate">{place.name}</h3>
                      <p className="text-sm text-text-muted truncate">{place.vicinity}</p>
                    </div>
                    {place.rating && (
                      <div className="flex items-center gap-1 ml-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">{place.rating}</span>
                        <span className="text-xs text-text-muted">({place.user_ratings_total})</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {place.opening_hours && (
                      <span
                        className={`flex items-center gap-1 ${
                          place.opening_hours.open_now ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                        {place.opening_hours.open_now ? 'Open' : 'Closed'}
                      </span>
                    )}
                    {place.formatted_phone_number && (
                      <a
                        href={`tel:${place.formatted_phone_number}`}
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="w-4 h-4" />
                        {place.formatted_phone_number}
                      </a>
                    )}
                    {place.website && (
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="w-4 h-4" />
                        Website
                      </a>
                    )}
                  </div>

                  {place.opening_hours?.weekday_text && (
                    <details className="mt-3">
                      <summary className="text-sm text-text-muted cursor-pointer hover:text-text">
                        View hours
                      </summary>
                      <div className="mt-2 text-xs text-text-muted space-y-1">
                        {place.opening_hours.weekday_text.map((day, i) => (
                          <p key={i}>{day}</p>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No results message */}
      {!isSearching && userLocation && places.length === 0 && (
        <Card className="text-center py-8">
          <MapPin className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">No pizza places found nearby.</p>
          <p className="text-sm text-text-muted mt-1">Try searching a different location.</p>
        </Card>
      )}
    </div>
  );
}
