import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { resolvePort } from '../utils/ports';
import { distanceKm, greatCircle } from '../utils/route';
import { colors, radius, spacing, typography } from '../theme/theme';

interface Props {
  origin?: string;
  destination?: string;
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

// The shipment's PLANNED ROUTE between its load and discharge ports, drawn as
// the shortest path on a map. It is not where the vessel is: the sources this
// app has give status and dates, not a position, and the screen says so. The
// map tiles and the Leaflet script load from the internet, so it needs a
// connection; ports that are not recognised are not drawn at all.
export function RouteMap({ origin, destination }: Props) {
  const from = useMemo(() => resolvePort(origin), [origin]);
  const to = useMemo(() => resolvePort(destination), [destination]);

  const html = useMemo(() => {
    if (!from || !to) return null;
    const line = greatCircle(from, to).map((p) => [p.lat, p.lng]);
    return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css">
<style>html,body,#map{height:100%;margin:0}</style></head><body><div id="map"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:true,attributionControl:true});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:8,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
var line=${JSON.stringify(line)};
var poly=L.polyline(line,{color:'#F26B21',weight:3,dashArray:'6 8'}).addTo(map);
L.circleMarker(line[0],{radius:7,color:'#0B1F3A',fillColor:'#0B1F3A',fillOpacity:1}).addTo(map).bindTooltip(${JSON.stringify(esc(from.name))},{permanent:true,direction:'top'});
L.circleMarker(line[line.length-1],{radius:7,color:'#1B7F3B',fillColor:'#1B7F3B',fillOpacity:1}).addTo(map).bindTooltip(${JSON.stringify(esc(to.name))},{permanent:true,direction:'top'});
map.fitBounds(poly.getBounds(),{padding:[30,30]});
</script></body></html>`;
  }, [from, to]);

  if (!from || !to) {
    const unknown = [!from ? origin || 'the load port' : null, !to ? destination || 'the discharge port' : null].filter(Boolean).join(' and ');
    return (
      <View style={styles.empty}>
        <Text style={typography.bodyMedium}>No map for this shipment</Text>
        <Text style={typography.caption}>
          {origin || destination ? `Cargo Flow does not recognise ${unknown} as a port it can place on a map.` : 'There is no load port and discharge port on this shipment yet. They appear once tracking has been captured, or when the bill of lading has them.'}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.map}>
        <WebView originWhitelist={['*']} source={{ html: html ?? '' }} javaScriptEnabled domStorageEnabled style={{ flex: 1 }} />
      </View>
      <Text style={styles.note}>
        {from.name} to {to.name}, about {distanceKm(from, to).toLocaleString()} km on the shortest path. This is the planned route, not the vessel's live position. Port locations are approximate.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 320, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  note: { ...typography.caption, marginTop: spacing.sm },
  empty: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs },
});
