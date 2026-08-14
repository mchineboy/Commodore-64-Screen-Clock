; Seven-segment screen/color-RAM blitter for the BASIC clock.
; BASIC fills $c300-$c30a, then SYS 49152 calls this routine.
.setcpu "6502"
.segment "CODE"

PARAM_POS   = $c300
PARAM_F     = $c301
PARAM_Q     = $c302
PARAM_R     = $c303
PARAM_S1    = $c304
PARAM_S2    = $c305
PARAM_S3    = $c306
PARAM_S4    = $c307
PARAM_S5    = $c308
PARAM_S6    = $c309
PARAM_S7    = $c30a

.macro VSEG address, colour
  lda #<address
  sta offset
  lda #>address
  sta offset+1
  lda PARAM_R
  sta character
  lda colour
  sta colour_byte
  jsr vertical
.endmacro

.macro HSEG address, colour
  lda #<address
  sta offset
  lda #>address
  sta offset+1
  lda PARAM_Q
  sta character
  lda colour
  sta colour_byte
  jsr horizontal
.endmacro

start:
  sei                    ; do not let an IRQ observe our temporary ZP pointers
  lda $02
  sta saved_zp
  lda $03
  sta saved_zp+1
  lda $04
  sta saved_zp+2
  lda $05
  sta saved_zp+3

  ; base = (position * 10) + signed screen-burn offset
  lda PARAM_POS
  asl
  sta scratch
  asl
  asl
  clc
  adc scratch
  sta base
  lda #0
  sta base+1
  lda PARAM_F
  sec
  sbc #128
  bpl :+
  dec base+1
:
  clc
  adc base
  sta base
  bcc :+
  inc base+1
:
  VSEG $0141, PARAM_S1
  VSEG $0146, PARAM_S2
  VSEG $0209, PARAM_S3
  VSEG $020e, PARAM_S4
  HSEG $011a, PARAM_S5
  HSEG $01e2, PARAM_S6
  HSEG $02aa, PARAM_S7

  lda saved_zp
  sta $02
  lda saved_zp+1
  sta $03
  lda saved_zp+2
  sta $04
  lda saved_zp+3
  sta $05
  cli
  rts

set_pointer:
  clc
  lda base
  adc offset
  sta $02
  lda base+1
  adc offset+1
  sta $03
  lda $02
  sta $04
  lda $03
  clc
  adc #$d4              ; $d800 - $0400
  sta $05
  rts

vertical:
  jsr set_pointer
  ldy #0
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  ldy #40
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  ldy #80
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  ldy #120
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  rts

horizontal:
  jsr set_pointer
  ldy #0
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  iny
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  iny
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  iny
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  iny
  lda character
  sta ($02),y
  lda colour_byte
  sta ($04),y
  rts

saved_zp:    .res 4
base:        .res 2
offset:      .res 2
scratch:     .res 1
character:   .res 1
colour_byte: .res 1
