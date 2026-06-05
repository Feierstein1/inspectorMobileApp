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
import { useColors } from '@/store/theme';

interface SignatureModalProps {
  visible: boolean;
  title?: string;
  onSave: (imageData: string) => void;
  onClose: () => void;
}

// Signature always uses white background + dark ink so the saved PNG is
// readable regardless of device theme.
const SIG_BG = '#FFFFFF';
const SIG_INK = '#1a1a1a';

const WEB_STYLE = `
  .m-signature-pad {
    box-shadow: none;
    border: none;
    background: ${SIG_BG};
    margin: 0;
  }
  .m-signature-pad--body {
    border: none;
    background: ${SIG_BG};
    top: 0; bottom: 0; left: 0; right: 0;
  }
  .m-signature-pad--footer { display: none; }
  body, html {
    margin: 0;
    padding: 0;
    height: 100%;
    background: ${SIG_BG};
    overflow: hidden;
  }
  canvas { touch-action: none; }
`;

export default function SignatureModal({
  visible,
  title = 'Sign Here',
  onSave,
  onClose,
}: SignatureModalProps) {
  const c = useColors();
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
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Text style={[styles.cancelText, { color: c.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: c.text }]}>{title}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Text style={[styles.saveText, { color: c.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Hint */}
          <Text style={[styles.hint, { color: c.textMuted }]}>
            Draw your signature in the box below
          </Text>

          {/* Canvas — fixed height, always white background */}
          <View style={[styles.canvasWrap, { borderColor: c.border }]}>
            <SignatureCanvas
              ref={ref}
              onOK={handleOK}
              onEmpty={handleEmpty}
              penColor={SIG_INK}
              backgroundColor={SIG_BG}
              webStyle={WEB_STYLE}
              style={styles.canvas}
              descriptionText=""
              clearText="Clear"
              confirmText="Save"
            />
          </View>

          {/* Clear */}
          <TouchableOpacity
            style={[styles.clearBtn, { borderColor: c.border }]}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <Text style={[styles.clearText, { color: c.textSecondary }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerBtn: { minWidth: 60 },
  title: { fontSize: 17, fontWeight: '600' },
  cancelText: { fontSize: 16 },
  saveText: { fontSize: 16, fontWeight: '700', textAlign: 'right' },
  hint: { fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  canvasWrap: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 200,
    backgroundColor: SIG_BG,
  },
  canvas: { height: 200, backgroundColor: SIG_BG },
  clearBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  clearText: { fontSize: 15 },
});
