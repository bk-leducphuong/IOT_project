const params = {
  comfort: {
    DEFAULT_TEMP_SET: 26, // °C
    DEFAULT_RH_SET: 60, // %

    DEADBAND: 2, // G36 yêu cầu deadband rõ
  },

  outdoor: {
    ECONOMIZER_MAX: 26, // °C (free cooling)
    HEAT_ENABLE: 35,
  },

  humidity: {
    DRY_OFFSET: 1, // làm lạnh sâu khi hút ẩm
  },
};

function g36Control({ T_room, RH_room, T_outdoor, userTempSet, userRHSet }) {
  // ===== USER SETPOINTS (OPTIONAL) =====
  const T_set = userTempSet ?? params.comfort.DEFAULT_TEMP_SET;

  const RH_set = userRHSet ?? params.comfort.DEFAULT_RH_SET;

  // ===== HEATING / COOLING SETPOINTS =====
  const T_heat = T_set - params.comfort.DEADBAND / 2;
  const T_cool = T_set + params.comfort.DEADBAND / 2;

  // ===== 1. HUMIDITY CONTROL (G36 PRIORITY) =====
  if (RH_room > RH_set) {
    return {
      mode: "DRY",
      targetTemperature: T_heat - params.humidity.DRY_OFFSET,
      reason: "Humidity above setpoint (G36)",
    };
  }

  // ===== 2. ECONOMIZER / FREE COOLING =====
  if (T_room > T_cool && T_outdoor <= params.outdoor.ECONOMIZER_MAX) {
    return {
      mode: "FAN",
      targetTemperature: null,
      reason: "Economizer cooling using outdoor air (G36)",
    };
  }

  // ===== 3. MECHANICAL COOLING =====
  if (T_room > T_cool) {
    return {
      mode: "COOL",
      targetTemperature: T_heat,
      reason: "Mechanical cooling (G36)",
    };
  }

  // ===== 4. HEATING =====
  if (T_room < T_heat) {
    if (T_outdoor < params.outdoor.HEAT_ENABLE) {
      return {
        mode: "HEAT",
        targetTemperature: T_heat,
        reason: "Heating mode (G36)",
      };
    } else {
      return {
        mode: "OFF",
        targetTemperature: T_heat,
        reason: "Outdoor temperature above heating enable setpoint (Lockout)",
      };
    }
  }

  // ===== 5. COMFORT / IDLE =====
  return {
    mode: "OFF",
    targetTemperature: null,
    reason: "Within comfort deadband (G36)",
  };
}

module.exports = { g36Control };
