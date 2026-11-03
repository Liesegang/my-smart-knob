#pragma once

#include <PacketSerial.h>

#include "../proto_gen/smartknob.pb.h"

#include "interface_callbacks.h"
#include "motor_task.h"
#include "serial_protocol.h"
#include "uart_stream.h"

class SerialProtocolProtobuf : public SerialProtocol {
    public:
        SerialProtocolProtobuf(Stream& stream, ConfigCallback config_callback,
                               std::function<void(bool)> ownership_callback = nullptr);
        ~SerialProtocolProtobuf(){};
        void log(const char* msg) override;
        void loop() override;
        void handleState(const PB_SmartKnobState& state) override;
        bool hostHasControl() const { return host_session_ != 0; }
        void sendButton(PB_NavigationAction action);
    
    private:
        Stream& stream_;
        ConfigCallback config_callback_;
        std::function<void(bool)> ownership_callback_;
        
        PB_FromSmartKnob pb_tx_buffer_;
        PB_ToSmartknob pb_rx_buffer_;

        uint8_t tx_buffer_[PB_FromSmartKnob_size + 4]; // Max message size + CRC32

        PacketSerial_<COBS, 0, (PB_ToSmartknob_size + 4) * 2 + 10> packet_serial_;

        uint32_t last_nonce_ = 0;

        PB_SmartKnobState latest_state_ = {};
        PB_SmartKnobState last_sent_state_ = {};
        uint32_t last_sent_state_millis_ = 0;

        bool state_requested_ = false;

        uint32_t host_session_ = 0;
        uint32_t last_host_renewal_ = 0;
        bool managed_host_ = false;
        PB_ButtonEvent buttons_[16] = {};
        uint8_t button_head_ = 0;
        uint8_t button_count_ = 0;
        uint32_t button_sequence_ = 0;
        uint32_t last_button_sent_ = 0;

        void handleHostControl(const PB_HostControl& control);
        void releaseHostControl();

        void sendPbTxBuffer();
        void handlePacket(const uint8_t* buffer, size_t size);
        void ack(uint32_t nonce);
};
