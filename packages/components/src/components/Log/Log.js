/*
Copyright 2019-2021 The Tekton Authors
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { Component, Fragment } from 'react';
import { SkeletonText } from 'carbon-components-react';
import { FixedSizeList as List } from 'react-window';
import { injectIntl } from 'react-intl';
import commonUtils from "../../utils/commonUtils";
import { DownToBottom16, UpToTop16 } from "@carbon/icons-react";

import Ansi from '../LogFormat';

const LogLine = ({ data, index, style }) => (
  <div style={style}>
    <Ansi>{`${data[index]}\n`}</Ansi>
  </div>
);

const itemSize = 15; // This should be kept in sync with the line-height in SCSS
const defaultHeight = itemSize * 100 + itemSize / 2;
const keysToScroll = ["Space", "Enter"];
const scrlBtnOffsetRem = 4 +1.6 ; // see css file

export class LogContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { loading: true };
    this.logRef = React.createRef();
    this.textRef = React.createRef();
  }

  componentDidMount() {
    this.loadLog();
    window.addEventListener("scroll", this.handleLogScroll, true);
    if (this.props.stepStatus?.terminated === false && this.isLogBelowViewBottom()) {
      this.scrollToLogBottom();
      return; // the scroll event listener will call handleLogScroll
    }
    this.handleLogScroll();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.logs?.length !== this.state.logs?.length ||
      prevProps.isLogsMaximized !== this.props.isLogsMaximized
    ) {
      if (this.state.shouldShowScrollToBottom === false &&
        (this.props.stepStatus?.terminated === false ||
          this.props.stepStatus?.terminated !== prevProps.stepStatus?.terminated) &&
        this.isLogBelowViewBottom()
      ) {
        this.scrollToLogBottom();
        return; // the scroll event listener will call handleLogScroll
      }
      this.handleLogScroll();
    }
  }

  componentWillUnmount() {
    window.removeEventListener("scroll", this.handleLogScroll, true);
    clearInterval(this.timer);
    this.cancelled = true;
  }

  scrollToLogTop() {
    this.textRef.current.scrollTop = 0;
    this.logRef.current.scrollIntoView(); //instant scrolling to top
  }

  scrollToLogBottom() {
    const textElement = this.textRef.current;
    if(commonUtils.isElementScrollable(textElement)) {
      textElement.scrollTop = Math.max(0, textElement.scrollHeight - textElement.clientHeight);
    }
    this.logRef.current.scrollIntoView(false); //instant scrolling to bottom
  }

  handleLogScroll() {
    this.setCssVariables();

    let shouldShowScrollToBottom, shouldShowScrollToTop;
    if (this.isLogOutsideOfScrollPort()) {
      shouldShowScrollToBottom = false;
      shouldShowScrollToTop = false;
    } else {
      shouldShowScrollToBottom = this.isLogAboveViewTop();
      shouldShowScrollToTop = this.isLogBelowViewBottom();
    }

    if (
      shouldShowScrollToBottom !== this.state.shouldShowScrollToBottom ||
      shouldShowScrollToTop !== this.state.shouldShowScrollToTop
    ) {
      this.setState({
        shouldShowScrollToBottom,
        shouldShowScrollToTop
      });
    }
  }

  isLogOutsideOfScrollPort() {
    const { logRectangle, effectiveScrollParentBottom, effectiveScrollParentTop } = this.getUsefulVars();
    const scrlBtnOffsetPx = scrlBtnOffsetRem * commonUtils.convertRemToPixels();

    return logRectangle.top + scrlBtnOffsetPx > effectiveScrollParentBottom ||
      logRectangle.bottom - scrlBtnOffsetPx < effectiveScrollParentTop;
  }

  setCssVariables() {
    const { logRectangle, effectiveScrollParentTop, effectiveScrollParentBottom } = this.getUsefulVars();
    const rootElement = document.documentElement;
    
    rootElement.style.setProperty("--log-element-right", logRectangle.right);
    rootElement.style.setProperty("--log-element-top", logRectangle.top);
    rootElement.style.setProperty("--log-element-bottom", logRectangle.bottom);
    
    rootElement.style.setProperty("--log-scrl-parent-top", effectiveScrollParentTop);

    rootElement.style.setProperty("--log-scrl-parent-bottom", effectiveScrollParentBottom);
  }

  isLogBelowViewBottom() {
    const { logRectangle, effectiveScrollParentBottom } = this.getUsefulVars();
    if (commonUtils.hasElementPositiveScrollBottom(this.textRef.current)) {
      return true;
    }
    return logRectangle.bottom > effectiveScrollParentBottom;
  }

  isLogAboveViewTop() {
    const { logRectangle, effectiveScrollParentTop } = this.getUsefulVars();
    if (this.textRef.current?.scrollTop > 0) {
      console.log(1);
      return true;
    }
    console.log(logRectangle);
    console.log(effectiveScrollParentTop);
    return logRectangle.top < effectiveScrollParentTop;
  }

  getUsefulVars() {
    const logElement = this.logRef.current;
    const logRectangle = logElement.getBoundingClientRect();
    const scrollableParent = commonUtils.getScrollableParent(logElement);
    const scrollableParentRect = scrollableParent.getBoundingClientRect();

    const effectiveScrollParentBottom = Math.min(document.body.clientHeight,
      scrollableParentRect.bottom - parseFloat(commonUtils.getStyle(scrollableParent, "border-bottom-width")));
    const effectiveScrollParentTop = Math.max(0.0 + parseFloat(commonUtils.getStyle(document.body, "border-top-width")),
      scrollableParentRect.top + parseFloat(commonUtils.getStyle(scrollableParent, "border-top-width")));
    return {
      logElement, logRectangle, scrollableParent,
      scrollableParentRect, effectiveScrollParentBottom, effectiveScrollParentTop
    };
  }

  getScrollButtons() {
    const { intl } = this.props;
    return (
      <Fragment>
        {this.state.shouldShowScrollToTop ? (
          <button
            id="scroll-to-top-btn"
            className="scroll-btn bx--copy-btn"
            onClick={this.scrollToLogTop}
            onKeyPress={(e) => commonUtils.onKeyPress(e, this.scrollToLogTop, keysToScroll)}
            type="button"
          >
            <UpToTop16>
              <title>
                {intl.formatMessage({
                  id: 'dashboard.pipelineRun.scrollToTop',
                  defaultMessage: 'Scroll to start of log'
                })}
              </title>
            </UpToTop16>
          </button>
        ) : null}
        {this.state.shouldShowScrollToBottom ? (
          <button
            id="scroll-to-bottom-btn"
            className="scroll-btn bx--copy-btn"
            onClick={this.scrollToLogBottom}
            onKeyPress={(e) => commonUtils.onKeyPress(e, this.scrollToLogBottom, keysToScroll)}
            type="button"
          >
            <DownToBottom16>
              <title>
                {intl.formatMessage({
                  id: 'dashboard.pipelineRun.scrollToBottom',
                  defaultMessage: 'Scroll to end of log'
                })}
              </title>
            </DownToBottom16>
          </button>
        ) : null}
      </Fragment>
    );
  }

  getLogList = () => {
    const { stepStatus, intl } = this.props;
    const { reason } = (stepStatus && stepStatus.terminated) || {};
    const {
      logs = [
        intl.formatMessage({
          id: 'dashboard.pipelineRun.logEmpty',
          defaultMessage: 'No log available'
        })
      ]
    } = this.state;

    if (logs.length < 20000) {
      return <Ansi>{logs.join('\n')}</Ansi>;
    }

    const height = reason
      ? Math.min(defaultHeight, itemSize * logs.length)
      : defaultHeight;

    return (
      <List
        height={height}
        itemCount={logs.length}
        itemData={logs}
        itemSize={itemSize}
        width="100%"
      >
        {LogLine}
      </List>
    );
  };

  getTrailerMessage = trailer => {
    const { intl } = this.props;

    switch (trailer) {
      case 'Completed':
        return intl.formatMessage({
          id: 'dashboard.pipelineRun.stepCompleted',
          defaultMessage: 'Step completed'
        });
      case 'Error':
        return intl.formatMessage({
          id: 'dashboard.pipelineRun.stepFailed',
          defaultMessage: 'Step failed'
        });
      default:
        return null;
    }
  };

  readChunks = ({ done, value }, decoder, text = '') => {
    if (this.cancelled) {
      this.reader.cancel();
      return undefined;
    }
    let logs = text;
    if (value) {
      logs += decoder.decode(value, { stream: !done });
      this.setState({
        loading: false,
        logs: logs.split('\n')
      });
    } else {
      this.setState({
        loading: false
      });
    }
    if (done) {
      return undefined;
    }
    return this.reader
      .read()
      .then(result => this.readChunks(result, decoder, logs))
      .catch(error => {
        console.error(error); // eslint-disable-line no-console
        return this.loadLog();
      });
  };

  loadLog = async () => {
    const {
      fetchLogs,
      forcePolling,
      intl,
      stepStatus,
      pollingInterval
    } = this.props;
    if (!fetchLogs) {
      return;
    }

    let continuePolling = false;
    try {
      continuePolling = forcePolling || (stepStatus && !stepStatus.terminated);
      const logs = await fetchLogs();
      if (logs?.getReader) {
        // logs is a https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
        const decoder = new TextDecoder();
        this.reader = logs.getReader();
        await this.reader
          .read()
          .then(result => this.readChunks(result, decoder))
          .catch(error => {
            throw error;
          });
      } else {
        this.setState({
          loading: false,
          logs: logs ? logs.split('\n') : undefined
        });
        if (continuePolling) {
          this.timer = setTimeout(this.loadLog, pollingInterval);
        }
      }
    } catch (error) {
      console.error(error); // eslint-disable-line no-console
      this.setState({
        loading: false,
        logs: [
          intl.formatMessage({
            id: 'dashboard.pipelineRun.logFailed',
            defaultMessage: 'Unable to fetch log'
          })
        ]
      });
      if (continuePolling) {
        this.timer = setTimeout(this.loadLog, pollingInterval);
      }
    }
  };

  logTrailer = () => {
    const { stepStatus } = this.props;
    const { reason } = (stepStatus && stepStatus.terminated) || {};
    const trailer = this.getTrailerMessage(reason);
    if (!trailer) {
      return null;
    }

    return (
      <div className="tkn--log-trailer" data-status={reason}>
        {trailer}
      </div>
    );
  };

  render() {
    console.log(this.state);
    const { toolbar } = this.props;
    const { loading } = this.state;
    return (
      <pre className="tkn--log" ref={this.logRef}>
        {loading ? (
          <SkeletonText paragraph width="60%" />
        ) : (
          <>
            {toolbar}
            <div className="tkn--log-container" ref={this.textRef}>{this.getLogList()}</div>
            {this.logTrailer()}
            {this.getScrollButtons()}
          </>
        )}
      </pre>
    );
  }
}

LogContainer.defaultProps = {
  pollingInterval: 4000
};

export default injectIntl(LogContainer);
