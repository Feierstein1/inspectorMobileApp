import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SchemaItem } from '@/lib/api';
import { useColors, Colors } from '@/store/theme';

interface FormFieldProps {
  field: SchemaItem;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  localPhotos?: string[];
  onAddPhoto?: () => void;
  onRemovePhoto?: (uri: string) => void;
  error?: string;
}

export default function FormField({
  field,
  value,
  onChange,
  localPhotos = [],
  onAddPhoto,
  onRemovePhoto,
  error,
}: FormFieldProps) {
  const c = useColors();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.text }]}>
        {field.label}
        {field.required && <Text style={{ color: c.danger }}> *</Text>}
      </Text>

      {field.type === 'pass_fail' && (
        <PassFailField value={value as string | null} onChange={onChange} />
      )}

      {field.type === 'text' && (
        <>
          <TextInput
            style={[
              styles.input,
              { borderColor: error ? c.danger : c.border, color: c.text, backgroundColor: c.bg },
            ]}
            value={(value as string) ?? ''}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholderTextColor={c.textMuted}
            placeholder="Enter text…"
            maxLength={field.options?.maxLength}
          />
          {typeof value === 'string' && value.length > 0 && (
            <Text style={[styles.charCount, { color: c.textMuted }]}>
              {value.length}
              {field.options?.maxLength ? ` / ${field.options.maxLength}` : ''} characters
            </Text>
          )}
        </>
      )}

      {field.type === 'number' && (
        <TextInput
          style={[
            styles.input,
            { borderColor: error ? c.danger : c.border, color: c.text, backgroundColor: c.bg },
          ]}
          value={value !== null ? String(value) : ''}
          onChangeText={(t) => {
            const n = parseFloat(t);
            onChange(isNaN(n) ? null : n);
          }}
          keyboardType="numeric"
          placeholderTextColor={c.textMuted}
          placeholder={
            field.options?.min !== undefined && field.options?.max !== undefined
              ? `${field.options.min} – ${field.options.max}`
              : 'Enter number…'
          }
        />
      )}

      {field.type === 'dropdown' && (
        <>
          <TouchableOpacity
            style={[
              styles.input,
              styles.dropdownTrigger,
              { borderColor: error ? c.danger : c.border, backgroundColor: c.bg },
            ]}
            onPress={() => setDropdownOpen(true)}
          >
            <Text
              style={
                value
                  ? { color: c.text, fontSize: 15 }
                  : { color: c.textMuted, fontSize: 15 }
              }
            >
              {value ?? 'Select an option…'}
            </Text>
            <Text style={[styles.chevron, { color: c.textSecondary }]}>›</Text>
          </TouchableOpacity>

          <Modal visible={dropdownOpen} transparent animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setDropdownOpen(false)}
            >
              <View style={[styles.dropdownMenu, { backgroundColor: c.surface }]}>
                <FlatList
                  data={field.options?.choices ?? []}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.dropdownItem,
                        { borderBottomColor: c.borderLight },
                        value === item && { backgroundColor: c.primaryBg },
                      ]}
                      onPress={() => {
                        onChange(item);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: value === item ? c.primary : c.text },
                          value === item && { fontWeight: '600' },
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </>
      )}

      {(field.type === 'date' || field.type === 'datetime') && (
        <DatePickerField
          value={value as string | null}
          onChange={onChange}
          mode={field.type}
          error={error}
          c={c}
        />
      )}

      {field.type === 'photo' && (
        <PhotoField
          localPhotos={localPhotos}
          maxPhotos={field.options?.maxPhotos}
          onAddPhoto={onAddPhoto}
          onRemovePhoto={onRemovePhoto}
          error={error}
          borderColor={c.border}
          errorColor={c.danger}
          mutedColor={c.textMuted}
          surfaceAlt={c.surfaceAlt}
          dangerColor={c.danger}
          dangerBg={c.dangerBg}
        />
      )}

      {error && <Text style={[styles.errorText, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

// ── Date / Datetime Picker ─────────────────────────────────────────────────

function parseDateValue(str: string, isDatetime: boolean): Date {
  if (!str) return new Date();
  // Store format: YYYY-MM-DD or YYYY-MM-DD HH:MM
  const d = isDatetime ? new Date(str.replace(' ', 'T')) : new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatForDisplay(str: string | null, isDatetime: boolean): string {
  if (!str) return '';
  const d = parseDateValue(str, isDatetime);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  if (!isDatetime) return `${mm}/${dd}/${yyyy}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

function formatForStorage(d: Date, isDatetime: boolean): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (!isDatetime) return `${yyyy}-${mm}-${dd}`;
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function DatePickerField({
  value,
  onChange,
  mode,
  error,
  c,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  mode: 'date' | 'datetime';
  error?: string;
  c: Colors;
}) {
  const isDatetime = mode === 'datetime';
  const [showPicker, setShowPicker] = useState(false);
  // iOS: accumulate changes until Done is pressed
  const [tempDate, setTempDate] = useState<Date>(() =>
    value ? parseDateValue(value, isDatetime) : new Date()
  );

  const displayValue = formatForDisplay(value, isDatetime);
  const pickerDate = value ? parseDateValue(value, isDatetime) : new Date();
  const pickerMode = isDatetime ? 'datetime' : 'date';

  function openPicker() {
    setTempDate(pickerDate);
    setShowPicker(true);
  }

  // Android: picker auto-dismisses; apply immediately
  function handleAndroid(event: DateTimePickerEvent, selected?: Date) {
    setShowPicker(false);
    if (event.type === 'set' && selected) {
      onChange(formatForStorage(selected, isDatetime));
    }
  }

  // iOS: accumulate without applying
  function handleIOS(_event: DateTimePickerEvent, selected?: Date) {
    if (selected) setTempDate(selected);
  }

  function confirmIOS() {
    onChange(formatForStorage(tempDate, isDatetime));
    setShowPicker(false);
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.dateTrigger,
          { borderColor: error ? c.danger : c.border, backgroundColor: c.bg },
        ]}
        onPress={openPicker}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dateTriggerText,
            { color: value ? c.text : c.textMuted },
          ]}
        >
          {displayValue || (isDatetime ? 'Select date & time…' : 'Select date…')}
        </Text>
        <Text style={{ fontSize: 16 }}>📅</Text>
      </TouchableOpacity>

      {/* Android: renders directly as a system dialog */}
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={pickerDate}
          mode={pickerMode}
          display="default"
          onChange={handleAndroid}
        />
      )}

      {/* iOS: sheet modal with spinner + Cancel/Done */}
      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.iosSheet}>
            <View style={[styles.iosSheetInner, { backgroundColor: c.surface }]}>
              <View style={[styles.iosSheetHeader, { borderBottomColor: c.border }]}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={[styles.iosSheetCancel, { color: c.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={[styles.iosSheetDone, { color: c.primary }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode={pickerMode}
                display="spinner"
                onChange={handleIOS}
                style={{ height: 200 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

// ── Pass/Fail ──────────────────────────────────────────────────────────────

function PassFailField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <View style={styles.passFail}>
      <TouchableOpacity
        style={[styles.passFailBtn, styles.passBtn, value === 'pass' && styles.passActive]}
        onPress={() => onChange('pass')}
        activeOpacity={0.8}
      >
        <Text style={[styles.passFailText, value === 'pass' && styles.passFailTextActive]}>
          PASS
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.passFailBtn, styles.failBtn, value === 'fail' && styles.failActive]}
        onPress={() => onChange('fail')}
        activeOpacity={0.8}
      >
        <Text style={[styles.passFailText, value === 'fail' && styles.passFailTextActive]}>
          FAIL
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Photo Field ────────────────────────────────────────────────────────────

function PhotoField({
  localPhotos,
  maxPhotos,
  onAddPhoto,
  onRemovePhoto,
  error,
  borderColor,
  errorColor,
  mutedColor,
  surfaceAlt,
  dangerColor,
  dangerBg,
}: {
  localPhotos: string[];
  maxPhotos?: number;
  onAddPhoto?: () => void;
  onRemovePhoto?: (uri: string) => void;
  error?: string;
  borderColor: string;
  errorColor: string;
  mutedColor: string;
  surfaceAlt: string;
  dangerColor: string;
  dangerBg: string;
}) {
  const canAdd = !maxPhotos || localPhotos.length < maxPhotos;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.photoRow}
    >
      {localPhotos.map((uri) => (
        <View key={uri} style={[styles.photoCard, { borderColor }]}>
          <Image source={{ uri }} style={styles.photoImage} />
          <TouchableOpacity
            style={[styles.removeBtn, { backgroundColor: dangerBg }]}
            onPress={() => onRemovePhoto?.(uri)}
            activeOpacity={0.7}
          >
            <Text style={[styles.removeBtnText, { color: dangerColor }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
      {canAdd && (
        <TouchableOpacity
          style={[
            styles.addPhotoBtn,
            { borderColor: error ? errorColor : borderColor, backgroundColor: surfaceAlt },
          ]}
          onPress={onAddPhoto}
        >
          <Text style={[styles.addPhotoIcon, { color: mutedColor }]}>+</Text>
          <Text style={[styles.addPhotoLabel, { color: mutedColor }]}>Add Photo</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { marginBottom: 16, borderRadius: 12, padding: 14, borderWidth: 1 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  charCount: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  errorText: { fontSize: 12, marginTop: 4 },

  // Date picker trigger
  dateTrigger: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  dateTriggerText: { fontSize: 15 },

  // iOS sheet
  iosSheet: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  iosSheetInner: { borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  iosSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  iosSheetCancel: { fontSize: 16 },
  iosSheetDone: { fontSize: 16, fontWeight: '600' },

  // Pass/Fail
  passFail: { flexDirection: 'row', gap: 12 },
  passFailBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  passBtn: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  failBtn: { borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  passActive: { backgroundColor: '#16A34A' },
  failActive: { backgroundColor: '#DC2626' },
  passFailText: { fontSize: 18, fontWeight: '700', color: '#374151' },
  passFailTextActive: { color: '#fff' },

  // Dropdown
  dropdownTrigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chevron: { fontSize: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dropdownMenu: { borderRadius: 12, overflow: 'hidden', maxHeight: 320 },
  dropdownItem: { padding: 16, borderBottomWidth: 1 },
  dropdownItemText: { fontSize: 16 },

  // Photos
  photoRow: { flexDirection: 'row', gap: 10, paddingBottom: 2 },
  photoCard: {
    width: 100,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: 90 },
  removeBtn: {
    paddingVertical: 7,
    alignItems: 'center',
  },
  removeBtnText: { fontSize: 12, fontWeight: '600' },
  addPhotoBtn: {
    width: 100,
    height: 120,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoIcon: { fontSize: 28 },
  addPhotoLabel: { fontSize: 12, fontWeight: '500' },
});
