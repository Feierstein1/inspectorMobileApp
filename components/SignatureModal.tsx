import { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import SignatureCanvas from 'react-native-signature-canvas';
import { useColors } from '@/store/theme';

interface SignatureModalProps {
  visible: boolean;
  title?: string;
  onSave: (imageData: string) => void;
  onClose: () => void;
}

export default function SignatureModal({
  visible,
  title = 'Sign Here',
  onSave,
  onClose,
}: SignatureModalProps) {
  const c = useColors();
  const ref = useRef<SignatureCanvas>(null);

  function handleOK(signature: string) {
    onSave(signature);
    onClose();
  }

  function handleClear() {
    ref.current?.clearSignature();
  }

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; background: ${c.surface}; }
    .m-signature-pad--body { border: none; background: ${c.surface}; }
    .m-signature-pad--footer { display: none; }
    body, html { margin: 0; padding: 0; height: 100%; background: ${c.surface}; }
  `;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: c.surface }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Text style={[styles.cancel, { color: c.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={[styles.clear, { color: c.primary }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        <SignatureCanvas
          ref={ref}
          onOK={handleOK}
          descriptionText=""
          clearText="Clear"
          confirmText="Save"
          webStyle={webStyle}
          style={styles.canvas}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 16 },
  clear: { fontSize: 16 },
  canvas: { flex: 1 },
});
