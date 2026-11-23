import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useKeepAwake } from 'expo-keep-awake';
import { requestReadSMSPermission, checkIfHasSMSPermission, startReadSMS } from '@maniac-tech/react-native-expo-read-sms';
import { Config, loadConfig, saveConfig } from './src/store';
import { clearLog, enqueue, flush, FlushResult, getLog, getQueue, LogEntry, onQueueChange, recordIgnored } from './src/queue';
import { parseSmsEvent, shouldForward } from './src/sms';

const PROBLEM: Record<NonNullable<FlushResult['problem']>, string> = {
  auth: 'The server rejected the API key. Messages are kept and will be sent once the key is fixed.',
  network: 'No connection. Messages are kept and will be sent when it returns.',
  server: 'The server had a problem. Messages are kept and will be retried.',
  not_configured: 'Enter the server address and API key below.',
};

function KeepAwake() {
  useKeepAwake();
  return null;
}

// Phone-side half of the mobile-money payment checks. It forwards payment
// text messages from the senders you list to the Cargo Flow server, which
// matches them to pending payments. It reads messages only while the app is
// open (Android stops background apps), so leave it open on a dedicated phone.
export default function App() {
  const [config, setConfig] = useState<Config>({ baseUrl: '', apiKey: '', senders: [] });
  const [sendersText, setSendersText] = useState('');
  const [permission, setPermission] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [forwarding, setForwarding] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [queued, setQueued] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const configRef = useRef(config);
  const forwardingRef = useRef(true);
  const started = useRef(false);

  configRef.current = config;
  forwardingRef.current = forwarding;

  const refresh = useCallback(async () => {
    setQueued((await getQueue()).length);
    setLog(await getLog());
  }, []);

  const send = useCallback(async () => {
    const r = await flush(configRef.current);
    setStatus(r.problem ? PROBLEM[r.problem] : r.sent > 0 ? `${r.sent} sent.` : null);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    loadConfig().then((c) => {
      setConfig(c);
      setSendersText(c.senders.join(', '));
    });
    checkIfHasSMSPermission().then((p) => setPermission(p.hasReceiveSmsPermission && p.hasReadSmsPermission)).catch(() => setPermission(false));
    refresh();
    const unsub = onQueueChange(() => { refresh(); });
    const net = NetInfo.addEventListener((s) => { if (s.isConnected) send(); });
    const app = AppState.addEventListener('change', (s) => { if (s === 'active') send(); });
    const timer = setInterval(send, 60000);
    return () => {
      unsub();
      net();
      app.remove();
      clearInterval(timer);
    };
  }, [refresh, send]);

  const startListening = async () => {
    const granted = await requestReadSMSPermission();
    const check = await checkIfHasSMSPermission();
    const ok = !!granted && check.hasReceiveSmsPermission && check.hasReadSmsPermission;
    setPermission(ok);
    if (!ok) return setStatus('SMS permission is needed. Allow it for this app in Android settings.');
    // The library adds a listener every time this is called, so it is started once per app run.
    if (started.current) return;
    started.current = true;
    await startReadSMS(async (state, sms) => {
      if (state !== 'success' || !forwardingRef.current) return;
      const parsed = parseSmsEvent(sms);
      if (!parsed) return;
      if (!shouldForward(parsed.address, configRef.current.senders)) return recordIgnored(parsed.address);
      await enqueue(parsed.address, parsed.message);
      send();
    });
    setListening(true);
    setStatus('Listening for messages from your listed senders.');
  };

  const save = async () => {
    const next = { ...config, baseUrl: config.baseUrl.trim(), apiKey: config.apiKey.trim(), senders: sendersText.split(',').map((s) => s.trim()).filter(Boolean) };
    await saveConfig(next);
    setConfig(next);
    setStatus('Saved.');
    send();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      {keepAwake ? <KeepAwake /> : null}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>CargoFlow SMS Gateway</Text>
        {Platform.OS !== 'android' ? <Text style={styles.warn}>This app only works on Android.</Text> : null}

        <View style={styles.card}>
          <Text style={styles.h}>Status</Text>
          <Text>SMS permission: {permission === null ? 'checking' : permission ? 'allowed' : 'not allowed'}</Text>
          <Text>Listening: {listening ? 'yes' : 'no'}   ·   Waiting to send: {queued}</Text>
          {status ? <Text style={styles.status}>{status}</Text> : null}
          {!listening ? <Btn label="Start listening" onPress={startListening} /> : null}
          <View style={styles.row}><Text>Forward messages</Text><Switch value={forwarding} onValueChange={setForwarding} /></View>
          <View style={styles.row}><Text>Keep the screen on</Text><Switch value={keepAwake} onValueChange={setKeepAwake} /></View>
          <Btn label="Send waiting messages now" onPress={send} outline />
          <Text style={styles.note}>Android only delivers messages to this app while it is open. Leave it open, on charge, on a phone used only for this.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.h}>Settings</Text>
          <Text style={styles.label}>Server address (ends in /api/v1)</Text>
          <TextInput style={styles.input} value={config.baseUrl} onChangeText={(t) => setConfig({ ...config, baseUrl: t })} autoCapitalize="none" autoCorrect={false} placeholder="https://api.example.com/api/v1" />
          <Text style={styles.label}>API key (from the admin dashboard, Gateway Devices)</Text>
          <TextInput style={styles.input} value={config.apiKey} onChangeText={(t) => setConfig({ ...config, apiKey: t })} autoCapitalize="none" autoCorrect={false} secureTextEntry />
          <Text style={styles.label}>Only forward messages from these senders (comma-separated names or numbers)</Text>
          <TextInput style={styles.input} value={sendersText} onChangeText={setSendersText} autoCapitalize="none" autoCorrect={false} placeholder="OrangeMoney, Afrimoney" />
          <Text style={styles.note}>Messages from anyone else are never read, sent or stored. With no sender listed, nothing is forwarded.</Text>
          <Btn label="Save" onPress={save} />
        </View>

        <View style={styles.card}>
          <View style={styles.row}><Text style={styles.h}>Recent activity</Text><TouchableOpacity onPress={() => clearLog()}><Text style={styles.link}>Clear</Text></TouchableOpacity></View>
          {log.length === 0 ? <Text style={styles.note}>Nothing yet.</Text> : null}
          {log.map((l) => (
            <View key={`${l.id}-${l.at}`} style={styles.logRow}>
              <Text style={styles.logTop}>{l.status.toUpperCase()} · {l.address} · {new Date(l.at).toLocaleTimeString()}</Text>
              {l.preview ? <Text style={styles.note}>{l.preview}</Text> : null}
              {l.detail ? <Text style={styles.note}>{l.detail}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Btn({ label, onPress, outline }: { label: string; onPress: () => void; outline?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.btn, outline && styles.btnOutline]}>
      <Text style={[styles.btnText, outline && styles.btnTextOutline]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#0B1F3A' },
  warn: { color: '#B3261E', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 8 },
  h: { fontSize: 16, fontWeight: '700', color: '#0B1F3A' },
  label: { fontSize: 13, color: '#555' },
  input: { borderWidth: 1, borderColor: '#D5D8DD', borderRadius: 8, padding: 10, fontSize: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { color: '#1E6FD9', fontWeight: '600' },
  note: { fontSize: 12, color: '#666' },
  btn: { backgroundColor: '#F26B21', borderRadius: 8, padding: 12, alignItems: 'center' },
  btnOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#F26B21' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnTextOutline: { color: '#F26B21' },
  link: { color: '#1E6FD9', fontWeight: '600' },
  logRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd', paddingTop: 6 },
  logTop: { fontSize: 12, fontWeight: '700', color: '#333' },
});
