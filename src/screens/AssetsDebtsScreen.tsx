import React from 'react';
import { ScreenId, Asset, Debt } from '../types';
import { AssetsMainScreen } from './AssetsMainScreen';

interface AssetsDebtsScreenProps {
  onNavigate: (screen: ScreenId) => void;
  assets?: Asset[];
  debts?: Debt[];
}

export const AssetsDebtsScreen: React.FC<AssetsDebtsScreenProps> = (props) => {
  return <AssetsMainScreen {...props} />;
};

