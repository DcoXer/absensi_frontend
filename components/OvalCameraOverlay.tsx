import { StyleSheet, View } from 'react-native';

export const OVAL_W = 260;
export const OVAL_H = 320;

const OVERLAY = 'rgba(0,0,0,0.55)';

type Props = {
  screenWidth: number;
  screenHeight: number;
  /** Border colour of the oval guide ring. Default: white. */
  borderColor?: string;
};

/**
 * Absolutely-positioned overlay that darkens everything except the oval
 * face guide in the centre. Drop this directly on top of a CameraView or
 * preview Image that fills its parent.
 */
export default function OvalCameraOverlay({
  screenWidth,
  screenHeight,
  borderColor = '#fff',
}: Props) {
  const ovalLeft = (screenWidth - OVAL_W) / 2;
  const ovalTop = (screenHeight - OVAL_H) / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top strip */}
      <View style={{ height: ovalTop, backgroundColor: OVERLAY }} />

      {/* Middle row: left dark | oval hole | right dark */}
      <View style={{ flexDirection: 'row', height: OVAL_H }}>
        <View style={{ width: ovalLeft, backgroundColor: OVERLAY }} />
        <View style={[styles.oval, { borderColor }]} />
        <View style={{ flex: 1, backgroundColor: OVERLAY }} />
      </View>

      {/* Bottom strip */}
      <View style={{ flex: 1, backgroundColor: OVERLAY }} />
    </View>
  );
}

const styles = StyleSheet.create({
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    // borderRadius = half the width → fully rounded sides, slight flat on top/bottom
    // This is intentional — it looks like a natural face guide oval.
    borderRadius: OVAL_W / 2,
    borderWidth: 3,
  },
});
