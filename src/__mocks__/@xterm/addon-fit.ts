export class FitAddon {
  activate = jest.fn();
  dispose = jest.fn();
  fit = jest.fn();
  proposeDimensions = jest.fn(() => undefined);
}
