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
} from 'react-native';
import { SchemaItem } from '@/lib/api';

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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {field.label}
        {field.required && <Text style={styles.required}> *</Text>}
      </Text>

      {field.type === 'pass_fail' && (
        <PassFailField value={value as string | null} onChange={onChange} />
      )}

      {field.type === 'text' && (
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value as string ?? ''}
          onChangeText={onChange}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          placeholderTextColor="#9CA3AF"
          placeholder="Enter text..."
        />
      )}

      {field.type === 'number' && (
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value !== null ? String(value) : ''}
          onChangeText={(t) => {
            const n = parseFloat(t);
            onChange(isNaN(n) ? null : n);
          }}
          keyboardType="numeric"
          placeholderTextColor="#9CA3AF"
          placeholder={
            field.options?.min !== undefined && field.options?.max !== undefined
              ? `${field.options.min} – ${field.options.max}`
              : 'Enter number...'
          }
        />
      )}

      {field.type === 'dropdown' && (
        <>
          <TouchableOpacity
            style={[styles.input, styles.dropdownTrigger, error && styles.inputError]}
            onPress={() => setDropdownOpen(true)}
          >
            <Text style={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {value ?? 'Select an option...'}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <Modal visible={dropdownOpen} transparent animationType="fade">
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setDropdownOpen(false)}
            >
              <View style={styles.dropdownMenu}>
                <FlatList
                  data={field.options?.choices ?? []}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.dropdownItem, value === item && styles.dropdownItemSelected]}
                      onPress={() => {
                        onChange(item);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          value === item && styles.dropdownItemTextSelected,
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
        <TextInput
          style={[styles.input, error && styles.inputError]}
          value={value as string ?? ''}
          onChangeText={onChange}
          placeholderTextColor="#9CA3AF"
          placeholder={field.type === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:MM'}
        />
      )}

      {field.type === 'photo' && (
        <PhotoField
          localPhotos={localPhotos}
          maxPhotos={field.options?.maxPhotos}
          onAddPhoto={onAddPhoto}
          onRemovePhoto={onRemovePhoto}
          error={error}
        />
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
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
}: {
  localPhotos: string[];
  maxPhotos?: number;
  onAddPhoto?: () => void;
  onRemovePhoto?: (uri: string) => void;
  error?: string;
}) {
  const canAdd = !maxPhotos || localPhotos.length < maxPhotos;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
      {localPhotos.map((uri) => (
        <View key={uri} style={styles.photoThumb}>
          <Image source={{ uri }} style={styles.thumbImage} />
          <TouchableOpacity
            style={styles.removePhoto}
            onPress={() => onRemovePhoto?.(uri)}
          >
            <Text style={styles.removePhotoText}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      {canAdd && (
        <TouchableOpacity
          style={[styles.addPhotoBtn, error && styles.addPhotoBtnError]}
          onPress={onAddPhoto}
        >
          <Text style={styles.addPhotoIcon}>+</Text>
          <Text style={styles.addPhotoLabel}>Photo</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  required: { color: '#DC2626' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fff',
  },
  inputError: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 12, marginTop: 4 },

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
  dropdownValue: { fontSize: 15, color: '#111827' },
  dropdownPlaceholder: { fontSize: 15, color: '#9CA3AF' },
  chevron: { fontSize: 20, color: '#6B7280' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', maxHeight: 320 },
  dropdownItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemSelected: { backgroundColor: '#EFF6FF' },
  dropdownItemText: { fontSize: 16, color: '#111827' },
  dropdownItemTextSelected: { color: '#2563EB', fontWeight: '600' },

  // Photos
  photoRow: { flexDirection: 'row' },
  photoThumb: { width: 80, height: 80, marginRight: 8, borderRadius: 8, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  addPhotoBtnError: { borderColor: '#DC2626' },
  addPhotoIcon: { fontSize: 24, color: '#6B7280' },
  addPhotoLabel: { fontSize: 11, color: '#6B7280' },
});
