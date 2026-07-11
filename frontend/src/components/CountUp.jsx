import { useCountUp } from "../motion";

export default function CountUp({ value, duration, active = true, suffix = "" }) {
  const display = useCountUp(value, { duration, active });
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {display}
      {suffix}
    </span>
  );
}
