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
  const ref = useRef<SignatureCanvas>(null);

  function handleOK(signature: string) {
    onSave(signature);
    onClose();
  }

  function handleClear() {
    ref.current?.clearSignature();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clear}>Clear</Text>
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

const webStyle = `
  .m-signature-pad { box-shadow: none; border: none; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; }
  body, html { margin: 0; padding: 0; height: 100%; }
`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: { fontSize: 17, fontWeight: '600', color: '#111827' },
  cancel: { fontSize: 16, color: '#6B7280' },
  clear: { fontSize: 16, color: '#2563EB' },
  canvas: { flex: 1 },
});
