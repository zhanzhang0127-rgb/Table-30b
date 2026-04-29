import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export interface PickedLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export function useLocationPicker() {
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const reverseGeocode = trpc.restaurants.reverseGeocode.useMutation();

  const fetchLocation = async (): Promise<PickedLocation | null> => {
    if (!navigator.geolocation) {
      toast.error("你的浏览器不支持定位功能");
      return null;
    }

    setLoading(true);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;

          try {
            const result = await reverseGeocode.mutateAsync({ latitude, longitude });
            const nextLocation: PickedLocation = {
              address: result.address,
              latitude,
              longitude,
            };
            setLocation(nextLocation);
            toast.success(`已获取位置：${result.address}`);
            resolve(nextLocation);
          } catch {
            const fallbackAddress = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            const nextLocation: PickedLocation = {
              address: fallbackAddress,
              latitude,
              longitude,
            };
            setLocation(nextLocation);
            toast.warning("位置已获取，但地址解析失败");
            resolve(nextLocation);
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          setLoading(false);
          toast.error(err.code === 1 ? "请允许浏览器访问你的位置" : "无法获取位置，请稍后重试");
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const clearLocation = () => {
    setLocation(null);
  };

  return {
    location,
    loading,
    fetchLocation,
    clearLocation,
  };
}
