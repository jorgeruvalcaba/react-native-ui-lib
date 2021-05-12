import _ from 'lodash';
import React, {PureComponent, ReactNode} from 'react';
import {StyleSheet, StyleProp, ViewStyle, Animated, Easing, LayoutAnimation, LayoutChangeEvent} from 'react-native';
import {Constants} from '../../helpers';
import {Colors} from '../../style';
import {asBaseComponent} from '../../commons/new';
import View from '../view';
import TouchableOpacity from '../touchableOpacity';
import Button, {ButtonProps} from '../button';
import Card from '../card';

const PEEP = 8;
const DURATION = 300;
const MARGIN_BOTTOM = 24;
const buttonStartValue = 0.8;
const icon = require('./assets/arrow-down.png');

export interface StackAggregatorProps {
  /**
   * The initial state of the stack
   */
  collapsed?: boolean;
  /**
   * A setting that disables pressability on cards
   */
  disablePresses?: boolean;
  /**
   * The container style
   */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * The content container style
   */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * The items border radius
   */
  itemBorderRadius?: number;
  /**
   * Props passed to the 'show less' button
   */
  buttonProps?: ButtonProps;
  /**
   * A callback for item press
   */
  onItemPress?: (index: number) => void;
  /**
   * A callback for collapse state will change (value is future collapsed state)
   */
  onCollapseWillChange?: (future: boolean) => void;
  /**
   * A callback for collapse state change (value is collapsed state)
   */
  onCollapseChanged?: (collapsed: boolean) => void;
}

interface StackAggregatorState {
  collapsed?: boolean;
  firstItemHeight?: number;
}

/**
 * @description: Stack aggregator component
 * @modifiers: margin, padding
 * @example: https://github.com/wix/react-native-ui-lib/blob/master/demo/src/screens/componentScreens/StackAggregatorScreen.js
 */
class StackAggregator extends PureComponent<StackAggregatorProps, StackAggregatorState> {
  static displayName = 'StackAggregator';

  state = {
    collapsed: this.props.collapsed ?? true,
    firstItemHeight: undefined
  };

  itemsCount = React.Children.count(this.props.children);
  easeOut = Easing.bezier(0, 0, 0.58, 1);
  animatedScale = new Animated.Value(this.state.collapsed ? buttonStartValue : 1);
  animatedOpacity = new Animated.Value(this.state.collapsed ? buttonStartValue : 1);
  animatedScaleArray = this.getAnimatedScales();
  animatedContentOpacity = new Animated.Value(this.state.collapsed ? 0 : 1);

  componentDidUpdate(_prevProps: StackAggregatorProps, prevState: StackAggregatorState) {
    if (prevState.collapsed !== this.state.collapsed) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }

  getAnimatedScales() {
    return (
      React.Children.map(this.props.children, (_item, index) => new Animated.Value(this.getItemScale(index))) ?? []
    );
  }

  getItemScale(index: number) {
    if (this.state.collapsed) {
      if (index === this.itemsCount - 2) {
        return 0.95;
      }
      if (index === this.itemsCount - 1) {
        return 0.9;
      }
    }

    return 1;
  }

  animate = () => Promise.all([this.animateValues(), this.animateCards()]);

  animateValues() {
    const {collapsed} = this.state;
    const newValue = collapsed ? buttonStartValue : 1;

    return new Promise(resolve => {
      Animated.parallel([
        Animated.timing(this.animatedOpacity, {
          duration: DURATION,
          toValue: Number(newValue),
          useNativeDriver: true
        }),
        Animated.timing(this.animatedScale, {
          toValue: Number(newValue),
          easing: this.easeOut,
          duration: DURATION,
          useNativeDriver: true
        }),
        Animated.timing(this.animatedContentOpacity, {
          toValue: Number(collapsed ? 0 : 1),
          easing: this.easeOut,
          duration: DURATION,
          useNativeDriver: true
        })
      ]).start(resolve);
    });
  }

  animateCards() {
    const promises = [];

    for (let index = 0; index < this.itemsCount; index++) {
      const newScale = this.getItemScale(index);

      promises.push(new Promise(resolve => {
        Animated.timing(this.animatedScaleArray[index], {
          toValue: Number(newScale),
          easing: this.easeOut,
          duration: DURATION,
          useNativeDriver: true
        }).start(resolve);
      }));
    }

    return Promise.all(promises);
  }

  close = () => {
    this.setState({collapsed: true}, async () => {
      _.invoke(this.props, 'onCollapseWillChange', true);
      if (this.props.onCollapseChanged) {
        await this.animate();
        this.props.onCollapseChanged(true);
      } else {
        this.animate();
      }
    });
  };

  open = () => {
    this.setState({collapsed: false}, async () => {
      _.invoke(this.props, 'onCollapseWillChange', false);
      if (this.props.onCollapseChanged) {
        await this.animate();
        this.props.onCollapseChanged(false);
      } else {
        this.animate();
      }
    });
  };

  getTop(index: number) {
    let start = 0;

    if (index === this.itemsCount - 2) {
      start += PEEP;
    }
    if (index === this.itemsCount - 1) {
      start += PEEP * 2;
    }

    return start;
  }

  getStyle(index: number): ViewStyle {
    const {collapsed} = this.state;
    const top = this.getTop(index);

    if (collapsed) {
      return {
        position: index !== 0 ? 'absolute' : undefined,
        top
      };
    }

    return {
      marginBottom: MARGIN_BOTTOM,
      marginTop: index === 0 ? 40 : undefined
    };
  }

  onLayout = ({
    nativeEvent: {
      layout: {height}
    }
  }: LayoutChangeEvent) => height && this.setState({firstItemHeight: height});

  onItemPress = (index: number) => {
    _.invoke(this.props, 'onItemPress', index);
  };

  renderItem = (item: ReactNode, index: number) => {
    const {disablePresses, contentContainerStyle, itemBorderRadius = 0} = this.props;
    const {firstItemHeight, collapsed} = this.state;

    return (
      <Animated.View
        key={index}
        onLayout={index === 0 ? this.onLayout : undefined}
        style={[
          Constants.isIOS && styles.containerShadow,
          this.getStyle(index),
          {
            borderRadius: Constants.isIOS ? itemBorderRadius : undefined,
            alignSelf: 'center',
            zIndex: this.itemsCount - index,
            transform: [{scaleX: this.animatedScaleArray[index]}],
            width: Constants.screenWidth - 40,
            height: collapsed ? firstItemHeight : undefined
          }
        ]}
        collapsable={false}
      >
        <Card
          style={[contentContainerStyle, styles.card]}
          onPress={!disablePresses ? () => this.onItemPress(index) : undefined}
          borderRadius={itemBorderRadius}
          elevation={5}
        >
          <Animated.View style={index !== 0 ? {opacity: this.animatedContentOpacity} : undefined} collapsable={false}>
            {item}
          </Animated.View>
        </Card>
      </Animated.View>
    );
  };

  render() {
    const {children, containerStyle, buttonProps} = this.props;
    const {collapsed, firstItemHeight} = this.state;

    return (
      <View style={containerStyle}>
        <View style={{marginBottom: PEEP * 3}}>
          <Animated.View
            style={{
              position: 'absolute',
              right: 0,
              opacity: this.animatedOpacity,
              transform: [{scale: this.animatedScale}]
            }}
          >
            <Button
              label={'Show less'}
              iconSource={icon}
              link
              size={Button.sizes.small}
              {...buttonProps}
              marginH-24
              marginB-20
              onPress={this.close}
            />
          </Animated.View>

          {React.Children.map(children, (item, index) => {
            return this.renderItem(item, index);
          })}

          {collapsed && (
            <TouchableOpacity
              onPress={this.open}
              activeOpacity={1}
              style={[
                styles.touchable,
                {
                  height: firstItemHeight ? firstItemHeight ?? 0 + PEEP * 2 : undefined,
                  zIndex: this.itemsCount
                }
              ]}
            />
          )}
        </View>
      </View>
    );
  }
}

export default asBaseComponent<StackAggregatorProps, typeof StackAggregator>(StackAggregator);

const styles = StyleSheet.create({
  touchable: {
    position: 'absolute',
    width: '100%'
  },
  containerShadow: {
    backgroundColor: Colors.white,
    shadowColor: Colors.dark40,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: {height: 5, width: 0}
  },
  card: {
    overflow: 'hidden',
    flexShrink: 1
  }
});