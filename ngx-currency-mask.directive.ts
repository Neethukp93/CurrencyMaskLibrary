import { DecimalPipe } from "@angular/common";
import { Directive, ElementRef, forwardRef, HostListener, Input, OnInit } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

export const CURRENCY_INPUT_MASK_DIRECTIVE_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => NgxCurrencyMaskDirective),
  multi: true,
};

@Directive({
  selector: "[ngxMaskCurrencyMask]",
  providers: [CURRENCY_INPUT_MASK_DIRECTIVE_VALUE_ACCESSOR, DecimalPipe],
})
export class NgxCurrencyMaskDirective implements ControlValueAccessor, OnInit {
  @Input() precision: number = 1;
  @Input() decimalSeparator: string = ".";
  @Input() thousandSeparator: string = ",";
  private el: HTMLInputElement;
  private onModelChange: Function;
  private onModelTouched: Function;
  private lastNumVal: number;

  constructor(private elementRef: ElementRef, private decimalPipe: DecimalPipe) {}

  ngOnInit() {
    this.el = this.elementRef.nativeElement;
  }

  @HostListener("focus", ["$event"])
  handleFocus(event: any) {
    const strVal: string = this.getInputValue();
    const unmaskedStr: string = this.getUnmaskedValue(strVal);
    this.updateInputValue(unmaskedStr, false, "FOCUS");
  }

  @HostListener("cut", ["$event"])
  handleCut(event: any) {
    setTimeout(() => {
      this.inputUpdated();
    }, 0);
  }

  @HostListener("keypress", ["$event"])
  handleKeypress(event: any) {
    // Restrict characters
    const newChar: string = String.fromCharCode(event.which);
    let allowedChars: RegExp = /^[\d.]+$/;
    if (this.decimalSeparator == ",") {
      allowedChars = /^[\d,]+$/;
    }

    if (!allowedChars.test(newChar)) {
      event.preventDefault();
      return;
    }
    // Handle decimalSeparator input
    const currentValue: string = event.target.value;
    const separatorIdx: number = currentValue.indexOf(this.decimalSeparator);
    const hasFractionalPart: boolean = separatorIdx >= 0;
    if (!hasFractionalPart || newChar !== this.decimalSeparator) {
      return;
    }
    const isOutsideSelection = !this.isIdxBetweenSelection(separatorIdx);
    if (isOutsideSelection) {
      const positionAfterMark = separatorIdx + 1;
      this.setCursorPosition(positionAfterMark);
      event.preventDefault();
      return;
    }
  }

  @HostListener("input", ["$event"])
  handleInput(event: any) {
    this.inputUpdated();
  }

  @HostListener("paste", ["$event"])
  handlePaste(event: any) {
    setTimeout(() => {
      this.inputUpdated();
    }, 1);
  }

  @HostListener("blur", ["$event"])
  handleBlur(event: any) {
    const strVal: string = this.getInputValue();
    const numVal: number = this.convertStrToDecimal(strVal);
    this.maskInput(numVal);
    this.onModelTouched.apply(event);
  }

  registerOnChange(callbackFunction: Function): void {
    this.onModelChange = callbackFunction;
  }

  registerOnTouched(callbackFunction: Function): void {
    this.onModelTouched = callbackFunction;
  }

  setDisabledState(value: boolean): void {
    this.el.disabled = value;
  }

  writeValue(numValue: number): void {
    this.maskInput(numValue);
  }

  private maskInput(numVal: number): void {
    if (!this.isNumeric(numVal)) {
      this.updateInputValue("");
      return;
    }
    const strVal: string = this.convertDecimalToStr(numVal);
    const newVal: string = this.transformWithPipe(strVal);
    this.updateInputValue(newVal);
  }

  private inputUpdated() {
    this.restrictDecimalValue();
    const strVal: string = this.getInputValue();
    const unmaskedVal: string = this.getUnmaskedValue(strVal);
    let numVal: any = this.convertStrToDecimal(unmaskedVal);
    if (numVal !== this.lastNumVal) {
      this.lastNumVal = numVal;
      if (numVal !== null) {
        numVal = numVal.toFixed(this.precision);
      }
      if (this.decimalSeparator === " ") {
        numVal = null;
      }
      this.onModelChange(numVal);
    }
  }

  private restrictDecimalValue(): void {
    const strVal: string = this.getInputValue();
    const dotIdx: number = strVal.indexOf(this.decimalSeparator);
    const hasFractionalPart: boolean = dotIdx >= 0;
    if (hasFractionalPart) {
      const fractionalPart: string = strVal.substring(dotIdx + 1);
      if (fractionalPart.length > this.precision) {
        const choppedVal: string = strVal.substring(0, dotIdx + this.precision + 1);
        this.updateInputValue(choppedVal, true);
        return;
      }
    }
  }

  private transformWithPipe(str: string): string {
    const digitsInfo = "1." + this.precision + "-" + this.precision;
    if (this.decimalSeparator === ".") {
      let val = this.decimalPipe.transform(str, digitsInfo);
      if (this.thousandSeparator === " ") {
        val = val.replace(/[,]/g, " ");
      }
      return val;
    } else {
      let val = this.decimalPipe.transform(str, digitsInfo);
      val = val.replace(/[,]/g, " ");
      val = val.replace(/[.]/g, ",");
      if (this.thousandSeparator === ".") {
        val = val.replace(/ /g, ".");
      }
      return val;
    }
  }

  private getUnmaskedValue(value: string): string {
    if (this.decimalSeparator === ".") {
      return value.replace(/[^-\d\\.]/g, "");
    } else {
      return value.replace(/[^-\d\\,]/g, "").replace(/[,]/g, ".");
    }
  }

  private updateInputValue(value: string, savePosition = false, type?: string) {
    if (savePosition) {
      this.saveCursorPosition();
    }
    if (this.decimalSeparator === ",") {
      if (this.thousandSeparator !== ".") {
        value = value.replace(/[.]/g, ",");
      }

      if (this.thousandSeparator === "." && type === "FOCUS") {
        value = value.replace(/[.]/g, this.decimalSeparator);
      }
    }
    if (this.decimalSeparator === " ") {
      value = null;
    }
    this.el.value = value;
  }

  private getInputValue(): string {
    return this.el.value;
  }

  private convertStrToDecimal(str: string): number {
    if (this.decimalSeparator === ".") {
      return this.isNumeric(str) ? parseFloat(str) : null;
    } else {
      if (this.thousandSeparator === ".") {
        //str = str.replace(/[.]/g, '')
      }
      return str ? parseFloat(str.replace(/[,]/g, ".")) : null;
    }
  }

  private convertDecimalToStr(n: number): string {
    return this.isNumeric(n) ? n + "" : "";
  }

  private isNumeric(n: any): boolean {
    return !isNaN(parseFloat(n)) && isFinite(n);
  }

  private saveCursorPosition() {
    const position: number = this.el.selectionStart;
    setTimeout(() => {
      this.setCursorPosition(position);
    }, 1);
  }

  private setCursorPosition(position: number) {
    this.el.selectionStart = position;
    this.el.selectionEnd = position;
  }

  private isIdxBetweenSelection(idx: number) {
    if (this.el.selectionStart === this.el.selectionEnd) {
      return false;
    }
    return idx >= this.el.selectionStart && idx < this.el.selectionEnd;
  }
}
