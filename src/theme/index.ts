import { type PartialTheme } from '@pandacss/types';

export const theme: PartialTheme = {
  layerStyles: {
    textStroke: {
      value: {
        //@ts-expect-error TODO: incompatible type
        WebkitTextStrokeWidth: '0.23',
        //@ts-expect-error TODO: incompatible type
        WebkitTextStrokeColor: '{colors.fg.stroke}'
      }
    }
  },
  semanticTokens: {
    colors: {
      bg: {
        canvas: { value: { _light: '#fffafa', _dark: '#050406' } },
        default: { value: { _light: '#fff0ea', _dark: '#050406' } },
        subtle: { value: { _light: '#edcfcf', _dark: '#19171b' } },
        muted: { value: { _light: '#d9a6a6', _dark: '#2b0b0b' } },
        emphasized: { value: { _light: '#fc8e8e', _dark: '#4c0000' } },
        disabled: { value: { _light: '#a5a5a5', _dark: '#595959' } }
      },
      fg: {
        default: { value: { _light: '#050406', _dark: '#ffe8e8' } },
        stroke: { value: { _light: '#050406', _dark: '#2b0b0b' } },
        muted: { value: { _light: '#595959', _dark: '#cfdfe6' } },
        subtle: { value: { _light: '#767676', _dark: '#a5a5a5' } },
        disabled: { value: { _light: '#a5a5a5', _dark: '#595959' } },
        error: { value: { _light: '#cc1515', _dark: '#fc8e8e' } }
      },
      border: {
        default: { value: { _light: '#d9a6a6', _dark: '#600e0e' } },
        muted: { value: { _light: '#edcfcf', _dark: '#4c0000' } },
        subtle: { value: { _light: '#ffe8e8', _dark: '#2b0b0b' } },
        disabled: { value: { _light: '#a5a5a5', _dark: '#595959' } },
        outline: { value: { _light: '#600e0e66', _dark: '#fc8e8e88' } },
        error: { value: { _light: '#cc1515', _dark: '#fc8e8e' } }
      }
    }
  },
  keyframes: {
    rainbowScroll: {
      '0%': { backgroundPosition: '200% 50%' },
      '100%': { backgroundPosition: '0% 50%' }
    }
  },
  recipes: {}
};
