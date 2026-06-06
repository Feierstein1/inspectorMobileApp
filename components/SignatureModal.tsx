import { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useColors, useIsDark } from '@/store/theme';

interface SignatureModalProps {
  visible: boolean;
  title?: string;
  onSave: (imageData: string) => void;
  onClose: () => void;
}

// The canvas itself is always white + dark ink so the saved PNG looks the same
// everywhere regardless of the device theme. Only the modal chrome is themed.
const SIG_BG = '#FFFFFF';
const SIG_INK = '#1C1C1E';

function buildWebStyle(): string {
  return `
    * { box-sizing: border-box; }
    body, html {
      margin: 0; padding: 0; height: 100%;
      background: ${SIG_BG}; overflow: hidden;
    }
    .m-signature-pad {
      box-shadow: none; border: none;
      background: ${SIG_BG};
      position: absolute; inset: 0;
    }
    .m-signature-pad--body {
      border: none; background: ${SIG_BG};
      position: absolute; inset: 0;
    }
    .m-signature-pad--footer { display: none; }
    canvas { touch-action: none; display: block; }
  `;
}

export default function SignatureModal({
  visible,
  title = 'Add Signature',
  onSave,
  onClose,
}: SignatureModalProps) {
  const c = useColors();
  const isDark = useIsDark();
  const ref = useRef<SignatureCanvas>(null);

  function handleSave() {
    ref.current?.readSignature();
  }

  function handleOK(signature: string) {
    if (!signature || signature === 'data:image/png;base64,') {
      Alert.alert('Empty Signature', 'Please draw your signature before saving.');
      return;
    }
    onSave(signature);
    onClose();
  }

  function handleEmpty() {
    Alert.alert('Empty Signature', 'Please draw your signature before saving.');
  }

  function handleClear() {
    ref.current?.clearSignature();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              shadowColor: isDark ? '#000' : '#1F2937',
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: c.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Sign using your finger in the box below
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: c.bg, borderColor: c.border }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.closeBtnText, { color: c.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── Canvas ── */}
          <View style={styles.canvasSection}>
            <View
              style={[
                styles.canvasCard,
                {
                  borderColor: c.border,
                  shadowColor: isDark ? '#000' : '#9CA3AF',
                },
              ]}
            >
              {/* Label strip above canvas */}
              <View style={[styles.canvasLabel, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
                <View style={[styles.labelDot, { backgroundColor: c.primary }]} />
                <Text style={[styles.labelText, { color: c.textSecondary }]}>Signature area</Text>
              </View>

              {/* Drawing surface — always white */}
              <View style={styles.canvasWrap}>
                <SignatureCanvas
                  ref={ref}
                  onOK={handleOK}
                  onEmpty={handleEmpty}
                  penColor={SIG_INK}
                  backgroundColor={SIG_BG}
                  webStyle={buildWebStyle()}
                  style={styles.canvas}
                  descriptionText=""
                  clearText="Clear"
                  confirmText="Save"
                />
              </View>
            </View>

            <Text style={[styles.hint, { color: c.textMuted }]}>
              Draw your full signature. Tap Clear to start over.
            </Text>
          </View>

          {/* ── Footer ── */}
          <View style={[styles.footer, { borderTopColor: c.border }]}>
            {/* Clear — secondary action */}
            <TouchableOpacity
              style={[styles.clearBtn, { borderColor: c.border, backgroundColor: c.bg }]}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Text style={[styles.clearBtnText, { color: c.textSecondary }]}>Clear</Text>
            </TouchableOpacity>

            {/* Cancel + Save */}
            <View style={styles.footerRight}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: c.border }]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelBtnText, { color: c.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: c.primary }]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Text style={styles.saveBtnText}>Save Signature</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 20,
  },

  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  subtitle: { fontSize: 13, lineHeight: 18 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  closeBtnText: { fontSize: 12, fontWeight: '600' },

  // Canvas section
  canvasSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  canvasCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  canvasLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  labelDot: { width: 6, height: 6, borderRadius: 3 },
  labelText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  canvasWrap: { height: 200, backgroundColor: SIG_BG },
  canvas: { height: 200, backgroundColor: SIG_BG },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    gap: 10,
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  clearBtnText: { fontSize: 14, fontWeight: '500' },

  footerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 14, fontWeight: '500' },

  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
